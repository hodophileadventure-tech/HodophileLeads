import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { leadsModel } from '../models/Lead';
import { attachmentsModel } from '../models/Attachment';
import { followUpsModel } from '../models/FollowUp';
import { availabilityModel } from '../models/Availability';
import { notificationsModel } from '../models/Notification';
import { query, getClient } from '../utils/database';
import { calculateBookingHealthScore, calculateLeadDataHealth, generateFollowUpTasks } from '../services/lead-service';
import { enqueueConfirmedLeadNotification } from '../services/employeePortalService';
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
  if (body.tripBudget === '' || body.tripBudget == null) {
    delete payload.tripBudget;
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
  if (user.role === 'admin' || user.role === 'manager') return true;
  return String(lead.agentId) === String(user.id);
};

const isHotelOptionComplete = (hotelOption: any) => {
  if (!hotelOption) return false;
  return Boolean(
    hotelOption.hotelName?.trim() &&
    hotelOption.roomType?.trim() &&
    hotelOption.checkIn?.trim() &&
    hotelOption.checkOut?.trim()
  );
};

const normalizeConfirmationData = (lead: any, payload: any) => {
  return {
    ...lead,
    ...(payload.hotelInfo !== undefined ? { hotelInfo: payload.hotelInfo } : {}),
    ...(payload.hotelOptions !== undefined ? { hotelOptions: payload.hotelOptions } : {}),
    ...(payload.transportPreference !== undefined ? { transportPreference: payload.transportPreference } : {})
  };
};

const isLeadReadyForConfirmation = (lead: any) => {
  const hotelInfo = lead.hotelInfo || lead.hotel_info || null;
  const hotelOptions = lead.hotelOptions || lead.hotel_options;
  const transportPreference = lead.transportPreference || lead.transport_preference;

  const hasHotelDetail =
    (hotelInfo && isHotelOptionComplete(hotelInfo)) ||
    (Array.isArray(hotelOptions) && hotelOptions.some(isHotelOptionComplete));

  const hasTransport = typeof transportPreference === 'string' && transportPreference.trim().length > 0;
  return hasHotelDetail && hasTransport;
};

const confirmLeadAndEnqueue = async (leadId: string, updateData: Partial<any>) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const lead = await leadsModel.update(leadId, updateData, client);
    await enqueueConfirmedLeadNotification(lead, client);
    await client.query('COMMIT');
    return lead;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export const leadsController = {
  async list(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const defaultLimit = 10000; // 10k leads max (covers most cases)
      const { limit = defaultLimit, offset = 0, startDate, endDate, phone } = req.query as any;
      const scopeAgentId = req.user.role === 'agent' ? String(req.user.id) : undefined;
      const leads = await leadsModel.findAll(
        scopeAgentId,
        Number(limit) || defaultLimit,
        Number(offset) || 0,
        { startDate, endDate, phone }
      );
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
      const scopeAgentId = req.user.role === 'agent' ? String(req.user.id) : undefined;
      const leads = await leadsModel.findByPhone(phone as string, scopeAgentId);
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
      console.log('[LeadsController] Update request received for lead:', req.params.id);
      console.log('[LeadsController] Raw request body:', req.body);
      
      let payload;
      try {
        const normalized = normalizeLeadPayload(req.body, req.user.id);
        console.log('[LeadsController] After normalizeLeadPayload:', normalized);
        payload = validatePayload(leadSchema.fork(['clientName','email','phone','destination','travelDates','persons','budget'], (s) => s.optional()), normalized);
        console.log('[LeadsController] After schema validation:', payload);
      } catch (e: any) {
        console.log('[LeadsController] Schema validation error:', e.message);
        console.log('[LeadsController] Falling back to permissive validation');
        const normalized = normalizeLeadPayload(req.body, req.user.id);
        payload = validatePayload(Joi.object().unknown(true), normalized);
        console.log('[LeadsController] After permissive validation:', payload);
      }
      console.log('[LeadsController] Calling leadsModel.update with:', { leadId: req.params.id, payload });
      let lead;
      const shouldConfirmLead = payload && (
        payload.pipelineStage === 'confirmed' ||
        payload.status === 'booked' ||
        payload.leadOutcome === 'confirmed' ||
        payload.lead_outcome === 'confirmed'
      );

      if (shouldConfirmLead) {
        const existingLead = await leadsModel.findById(req.params.id);
        if (!existingLead) {
          return res.status(404).json({ message: 'Lead not found' });
        }

        const mergedLead = normalizeConfirmationData(existingLead, payload);
        if (!isLeadReadyForConfirmation(mergedLead)) {
          return res.status(400).json({
            message: 'Lead cannot be confirmed because hotel details and transport information are required.'
          });
        }

        lead = await confirmLeadAndEnqueue(req.params.id, payload);
        console.log('[LeadsController] Enqueued confirmed lead notification for Employee Portal', { leadId: lead.id });
      } else {
        lead = await leadsModel.update(req.params.id, payload);
      }

      if (lead && (lead.status === 'booked' || lead.leadOutcome === 'confirmed' || lead.pipelineStage === 'confirmed') && !isLeadReadyForConfirmation(lead)) {
        lead = await leadsModel.update(req.params.id, {
          status: 'contacted',
          leadOutcome: null,
          pipelineStage: 'contacted'
        } as any);
      }

      if (!lead) {
        console.log('[LeadsController] Lead not found:', req.params.id);
        return res.status(404).json({ message: 'Lead not found' });
      }
      console.log('[LeadsController] Lead updated successfully. Response status:', lead.status, 'potential:', lead.potential);
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
    } catch (error: any) {
      console.error('[LeadsController] Update error:', error.message);
      console.error('[LeadsController] Error stack:', error.stack);
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
      let lead;
      if (status === 'booked') {
        const existingLead = await leadsModel.findById(req.params.id);
        if (!existingLead) {
          return res.status(404).json({ message: 'Lead not found' });
        }
        if (!isLeadReadyForConfirmation(existingLead)) {
          return res.status(400).json({
            message: 'Lead cannot be marked booked until hotel details and transport information are filled.'
          });
        }
        lead = await confirmLeadAndEnqueue(req.params.id, { status });
        console.log('[LeadsController] Enqueued confirmed lead notification for Employee Portal via status update', { leadId: lead.id });
      } else {
        lead = await leadsModel.update(req.params.id, { status });
      }
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

      if (stage === 'confirmed') {
        const existingLead = await leadsModel.findById(req.params.id);
        if (!existingLead) {
          return res.status(404).json({ message: 'Lead not found' });
        }
        if (!isLeadReadyForConfirmation(existingLead)) {
          return res.status(400).json({
            message: 'Lead cannot be moved to confirmed until hotel details and transport information are filled.'
          });
        }
      }

      let lead = await leadsModel.update(req.params.id, { pipelineStage: stage as any });
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

      if (stage === 'confirmed') {
        try {
          const updatedLead = await confirmLeadAndEnqueue(req.params.id, { pipelineStage: stage });
          console.log('[LeadsController] Enqueued confirmed lead notification via updateStage', { leadId: req.params.id });
          lead = updatedLead;
        } catch (notifyErr) {
          console.error('[LeadsController] Failed to enqueue Employee Portal notification via updateStage:', notifyErr);
        }
      }

      if (eventType) {
        const tasks = await generateFollowUpTasks(req.params.id, eventType);
        for (const task of tasks) {
          await followUpsModel.create({
            leadId: req.params.id,
            assignedTo: req.user.id,
            createdBy: req.user.id,
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

      // Calculate lead data health (field completeness)
      const dataHealthScore = calculateLeadDataHealth(lead);
      
      // Determine health color based on data completeness
      let health: 'red' | 'yellow' | 'green' = 'red';
      if (dataHealthScore >= 70) health = 'green';
      else if (dataHealthScore >= 40) health = 'yellow';

      // Also calculate booking health for reference
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

      const bookingHealth = calculateBookingHealthScore({
        tripleLockComplete,
        clientApproved,
        paymentReceived,
        preDepartureTasksDone
      });

      res.json({
        leadId,
        score: dataHealthScore,
        health,
        dataHealth: {
          score: dataHealthScore,
          color: health
        },
        bookingHealth: {
          score: bookingHealth.score,
          health: bookingHealth.health,
          factors: {
            tripleLockComplete,
            clientApproved,
            paymentReceived,
            preDepartureTasksDone
          }
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
