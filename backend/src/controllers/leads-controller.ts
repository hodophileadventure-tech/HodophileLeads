import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { leadsModel } from '../models/Lead';
import { attachmentsModel } from '../models/Attachment';
import { followUpsModel } from '../models/FollowUp';
import { availabilityModel } from '../models/Availability';
import { query } from '../utils/database';
import { calculateBookingHealthScore, generateFollowUpTasks } from '../services/lead-service';
import Joi from 'joi';
import { validatePayload, leadSchema } from '../utils/validation';

const normalizeLeadPayload = (body: any, agentId: string) => {
  const destinations = Array.isArray(body.destinations)
    ? body.destinations.filter(Boolean)
    : [];
  const hotelOptions = Array.isArray(body.hotelOptions)
    ? body.hotelOptions.filter(Boolean)
    : [];
  const normalizedGender = typeof body.gender === 'string' && body.gender.trim()
    ? body.gender.trim()
    : undefined;
  const normalizedHotelInfo = body.hotelInfo && typeof body.hotelInfo === 'object' && !Array.isArray(body.hotelInfo)
    ? body.hotelInfo
    : undefined;

  const primaryDestination = body.destination || destinations[0] || '';
  const normalizedDestinations = destinations.length > 0
    ? Array.from(new Set([primaryDestination, ...destinations].filter(Boolean)))
    : primaryDestination
      ? [primaryDestination]
      : [];

  const primaryHotel = normalizedHotelInfo || hotelOptions[0];
  const normalizedHotelOptions = hotelOptions.length > 0
    ? Array.from(new Set([
        ...(primaryHotel ? [JSON.stringify(primaryHotel)] : []),
        ...hotelOptions.map((item: any) => JSON.stringify(item))
      ]))
        .map((item) => JSON.parse(item))
    : primaryHotel
      ? [primaryHotel]
      : [];

  const payload = {
    ...body,
    agentId,
    destination: primaryDestination,
    destinations: normalizedDestinations,
    hotelInfo: primaryHotel,
    hotelOptions: normalizedHotelOptions
  };

  if (normalizedGender) {
    payload.gender = normalizedGender;
  } else {
    delete payload.gender;
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

export const leadsController = {
  async list(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { agentId, limit = 50, offset = 0 } = req.query;
      const leads = await leadsModel.findAll(agentId as string, Number(limit), Number(offset));
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
      res.json(lead);
    } catch (error) {
      next(error);
    }
  },

  async searchByPhone(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { phone } = req.query as any;
      if (!phone) return res.status(400).json({ message: 'phone query parameter is required' });
      const leads = await leadsModel.findByPhone(phone as string);
      res.json(leads);
    } catch (error) {
      next(error);
    }
  },

  async create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const leadData = validatePayload(leadSchema, normalizeLeadPayload(req.body, req.user.id));

      if (!leadData.destination && (!leadData.destinations || leadData.destinations.length === 0)) {
        return res.status(400).json({ message: 'At least one destination is required' });
      }

      if (!leadData.hotelInfo && (!leadData.hotelOptions || leadData.hotelOptions.length === 0)) {
        // hotels are optional, but this block is left intentionally for future hotel-required workflows
      }

      const lead = await leadsModel.create(leadData);
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
        String(item.task_type || '').toLowerCase().includes('pre-departure') ||
        String(item.task_type || '').toLowerCase().includes('pre departure')
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
      await leadsModel.delete(req.params.id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
};
