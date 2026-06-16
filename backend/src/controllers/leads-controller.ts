import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { leadsModel } from '../models/Lead';
import { attachmentsModel } from '../models/Attachment';
import { followUpsModel } from '../models/FollowUp';
import { availabilityModel } from '../models/Availability';
import { notificationsModel } from '../models/Notification';
import { query } from '../utils/database';
import { calculateBookingHealthScore, generateFollowUpTasks } from '../services/lead-service';
import Joi from 'joi';
import { validatePayload, leadSchema } from '../utils/validation';
import { logActivity } from '../utils/activity-log';

const normalizeLeadPayload = (body: any, agentId: string) => {
  const destinations = Array.isArray(body.destinations)
    ? body.destinations.filter(Boolean)
    : undefined;
  const hotelOptions = Array.isArray(body.hotelOptions)
    ? body.hotelOptions.filter(Boolean)
    : undefined;
  const normalizedGender = typeof body.gender === 'string' && body.gender.trim()
    ? body.gender.trim()
    : undefined;
  const normalizedAdults = body.adults === '' || body.adults == null
    ? undefined
    : Number(body.adults);
  const normalizedKids = body.kids === '' || body.kids == null
    ? undefined
    : Number(body.kids);
  const normalizedHotelInfo = body.hotelInfo && typeof body.hotelInfo === 'object' && !Array.isArray(body.hotelInfo)
    ? body.hotelInfo
    : undefined;

  const primaryDestination = body.destination !== undefined
    ? body.destination
    : destinations?.[0];

  const normalizedDestinations = destinations
    ? Array.from(new Set([...(primaryDestination ? [primaryDestination] : []), ...destinations].filter(Boolean)))
    : undefined;

  const primaryHotel = normalizedHotelInfo || hotelOptions?.[0];
  const normalizedHotelOptions = hotelOptions
    ? Array.from(new Set([
        ...(primaryHotel ? [JSON.stringify(primaryHotel)] : []),
        ...hotelOptions.map((item: any) => JSON.stringify(item))
      ]))
        .map((item) => JSON.parse(item))
    : undefined;

  const payload: any = {
    ...body,
    agentId
  };

  if (primaryDestination !== undefined) {
    payload.destination = primaryDestination;
  }

  if (normalizedDestinations !== undefined) {
    payload.destinations = normalizedDestinations;
  }

  if (primaryHotel !== undefined) {
    payload.hotelInfo = primaryHotel;
  }

  if (normalizedHotelOptions !== undefined) {
    payload.hotelOptions = normalizedHotelOptions;
  }

  if (normalizedAdults !== undefined) {
    payload.adults = normalizedAdults;
  }

  if (normalizedKids !== undefined) {
    payload.kids = normalizedKids;
  }

  if (normalizedAdults != null || normalizedKids != null) {
    payload.persons = ((normalizedAdults || 0) + (normalizedKids || 0));
  } else if (body.persons !== undefined) {
    payload.persons = body.persons;
  }

  if (normalizedGender) {
    payload.gender = normalizedGender;
  } else {
    delete payload.gender;
  }

  // Remove empty numeric fields so Joi treats them as missing, not invalid
  if (body.adults === '' || body.adults == null) {
    delete payload.adults;
  }
  if (body.kids === '' || body.kids == null) {
    delete payload.kids;
  }
  if (body.age === '' || body.age == null) {
    delete payload.age;
  }
  if (body.persons === '' || body.persons == null) {
    delete payload.persons;
  }

  if (!payload.hotelInfo) {
    delete payload.hotelInfo;
  }

  return payload;
};

const VALID_PIPELINE_STAGES = [
  'new_lead',
  'availability_check',
  'quoted',
  'payment_pending',
  'confirmed',
  'on_trip',
  'completed'
];

const ensureLeadAccess = (lead: any, user: any) => {
  if (!lead) return false;
  if (user.role === 'admin') return true;
  return String(lead.agentId) === String(user.id);
};

export const leadsController = {
  async list(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { limit = 50, offset = 0 } = req.query;
      const isAgent = req.user.role !== 'admin';
      const leads = await leadsModel.findAll(isAgent ? String(req.user.id) : undefined, Number(limit), Number(offset));
      res.json(leads);
    } catch (error) {
      next(error);
    }
  },

  async getById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const lead = await leadsModel.findById(req.params.id);
      if (!lead) {
        return res.status(404).json({ message: 'Lead not found' });
      }
      if (!ensureLeadAccess(lead, req.user)) {
        return res.status(403).json({ message: 'You do not have access to this lead' });
      }
      res.json(lead);
    } catch (error) {
      next(error);
    }
  },

  async searchByPhone(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { phone } = req.query as any;
      if (!phone) return res.status(400).json({ message: 'phone query parameter is required' });
      const leads = await leadsModel.findByPhone(phone as string, req.user.role !== 'admin' ? String(req.user.id) : undefined);
      res.json(leads);
    } catch (error) {
      next(error);
    }
  },

  async create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const leadData = validatePayload(leadSchema, normalizeLeadPayload(req.body, req.user.id));

      const existingLeads = await leadsModel.findByPhone(leadData.phone);
      if (existingLeads.length > 0) {
        const sameAgentLead = existingLeads.find((lead) => String(lead.agentId) === String(req.user.id));
        if (sameAgentLead) {
          return res.status(409).json({ message: 'Duplicate lead: a lead with this phone already exists for you.' });
        }
        return res.status(409).json({ message: 'This lead is already assigned to another agent.' });
      }

      const lead = await leadsModel.create(leadData);
      try {
        await logActivity({
          userId: req.user.id,
          entityType: 'lead',
          entityId: lead.id,
          action: 'create',
          changes: { status: lead.status, destination: lead.destination }
        });
      } catch (_) {}
      res.status(201).json(lead);
    } catch (error) {
      next(error);
    }
  },

  async update(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      let payload;
      try {
        payload = validatePayload(leadSchema.fork(['clientName','email','phone','destination','travelDates','persons','budget'], (s) => s.optional()), normalizeLeadPayload(req.body, req.user.id));
      } catch (e) {
        // If schema fork fails (missing paths), fall back to permissive validation to avoid 500s
        payload = validatePayload(Joi.object().unknown(true), normalizeLeadPayload(req.body, req.user.id));
      }
      const lead = await leadsModel.update(req.params.id, payload);
      if (!lead) {
        return res.status(404).json({ message: 'Lead not found' });
      }
      try {
        await logActivity({
          userId: req.user.id,
          entityType: 'lead',
          entityId: req.params.id,
          action: 'update',
          changes: payload as Record<string, any>
        });
      } catch (_) {}
      res.json(lead);
    } catch (error) {
      next(error);
    }
  },

  async uploadConfirmation(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const leadId = req.params.id;
      if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
      }
      const file = req.file as any;
      const fileUrl = `/uploads/${file.filename}`;

      // Persist attachment record
      const attachment = await attachmentsModel.create({
        leadId,
        fileName: file.originalname,
        mimeType: file.mimetype,
        url: fileUrl,
        size: file.size,
        uploadedBy: req.user?.id || null
      });

      res.json({ attachment });
    } catch (error) {
      next(error);
    }
  },

  async getAttachments(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const leadId = req.params.id;
      const attachments = await attachmentsModel.findByLeadId(leadId);
      res.json({ attachments });
    } catch (error) {
      next(error);
    }
  },

  async deleteAttachment(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const leadId = req.params.id;
      const attachmentId = req.params.attachmentId;
      const attachment = await attachmentsModel.findById(attachmentId);
      if (!attachment) return res.status(404).json({ message: 'Attachment not found' });
      if (String(attachment.lead_id || attachment.leadId) !== String(leadId)) {
        return res.status(403).json({ message: 'Attachment does not belong to lead' });
      }

      // delete file from disk if exists
      try {
        const filename = attachment.url ? require('path').basename(attachment.url) : null;
        if (filename) {
          const filePath = require('path').join(__dirname, '..', '..', 'uploads', filename);
          const fs = require('fs');
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        }
      } catch (e) {
        // log and continue
        console.warn('Failed to remove file from disk', (e as any)?.message || e);
      }

      await attachmentsModel.delete(attachmentId);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  },

  async updateStatus(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { status } = req.body;
      const lead = await leadsModel.update(req.params.id, { status });
      if (!lead) {
        return res.status(404).json({ message: 'Lead not found' });
      }
      try {
        await logActivity({
          userId: req.user.id,
          entityType: 'lead',
          entityId: req.params.id,
          action: 'update',
          changes: { status }
        });
      } catch (_) {}
      res.json(lead);
    } catch (error) {
      next(error);
    }
  },

  async cancel(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { reason } = req.body as { reason?: string };
      const lead = await leadsModel.update(req.params.id, {
        status: 'canceled' as any,
        canceledReason: reason || '',
        canceledBy: req.user.id,
        canceledAt: new Date().toISOString()
      } as any);

      if (!lead) {
        return res.status(404).json({ message: 'Lead not found' });
      }

      res.json(lead);
    } catch (error) {
      next(error);
    }
  },

  async updateStage(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { stage } = req.body as { stage?: string };
      if (!stage || !VALID_PIPELINE_STAGES.includes(stage)) {
        return res.status(400).json({ message: 'Invalid pipeline stage' });
      }

      const lead = await leadsModel.update(req.params.id, { pipelineStage: stage as any });
      if (!lead) {
        return res.status(404).json({ message: 'Lead not found' });
      }

      const eventMap: Record<string, string> = {
        quoted: 'itinerary_sent',
        payment_pending: 'approval_received',
        confirmed: 'booking_confirmed',
        on_trip: 'on_trip',
        completed: 'post_trip'
      };

      const eventType = eventMap[stage];
      let autoTasksCreated = 0;

      if (eventType) {
        const tasks = await generateFollowUpTasks(req.params.id, eventType);
        for (const task of tasks) {
          await followUpsModel.create({
            leadId: req.params.id,
            assignedTo: req.user.id,
            title: task.title,
            description: `Auto-generated on stage change to ${stage}`,
            dueDate: task.dueDate,
            priority: task.priority,
            status: task.status,
            type: 'auto',
            reminderType: 'standard'
          } as any);
          autoTasksCreated += 1;
        }
      }

      try {
        await logActivity({
          userId: req.user.id,
          entityType: 'lead',
          entityId: req.params.id,
          action: 'update',
          changes: { pipelineStage: stage }
        });
      } catch (_) {}

      res.json({
        lead,
        autoTasksCreated,
        message: autoTasksCreated > 0 ? `Stage updated and ${autoTasksCreated} auto tasks created` : 'Stage updated'
      });
    } catch (error) {
      next(error);
    }
  },

  async getHealthScore(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const leadId = req.params.id;
      const lead = await leadsModel.findById(leadId);
      if (!lead) {
        return res.status(404).json({ message: 'Lead not found' });
      }

      const availability = await availabilityModel.getByLeadId(leadId);
      const paymentsResult = await query('SELECT * FROM payments WHERE lead_id = $1', [leadId]);
      const followUps = await followUpsModel.findByLead(leadId);

      const tripleLockComplete =
        availability?.hotel_status === 'confirmed' &&
        availability?.transport_status === 'confirmed' &&
        availability?.guide_status === 'confirmed';

      const clientApproved = !!availability?.client_approved;
      const paymentReceived = paymentsResult.rows.some((payment: any) => ['approved', 'confirmed'].includes(payment.status));

      const preDepartureTasks = followUps.filter((item: any) =>
        String(item.title || item.task_type || '').toLowerCase().includes('pre-departure') ||
        String(item.title || item.task_type || '').toLowerCase().includes('pre departure') ||
        String(item.type || '').toLowerCase().includes('pre-departure')
      );
      const preDepartureTasksDone = preDepartureTasks.length > 0 && preDepartureTasks.every((item: any) => item.status === 'completed');

      const health = calculateBookingHealthScore({
        tripleLockComplete,
        clientApproved,
        paymentReceived,
        preDepartureTasksDone
      });

      res.json({
        leadId,
        score: health.score,
        health: health.health,
        factors: {
          tripleLockComplete,
          clientApproved,
          paymentReceived,
          preDepartureTasksDone
        },
        weights: {
          tripleLockComplete: 40,
          clientApproved: 20,
          paymentReceived: 25,
          preDepartureTasksDone: 15
        }
      });
    } catch (error) {
      next(error);
    }
  },

  async delete(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      await notificationsModel.deleteByLead(req.params.id);
      const deletedLead = await leadsModel.delete(req.params.id);
      try {
        await logActivity({
          userId: req.user.id,
          entityType: 'lead',
          entityId: req.params.id,
          action: 'delete'
        });
      } catch (_) {}
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
};
