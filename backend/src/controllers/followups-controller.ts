import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { followUpsModel } from '../models/FollowUp';
import { notificationsModel } from '../models/Notification';
import { leadsModel } from '../models/Lead';
import { sendToUser } from '../utils/wsServer';
import { validatePayload, followUpSchema } from '../utils/validation';
import { logActivity } from '../utils/activity-log';

const ensureLeadAccess = (lead: any, user: any) => {
  if (!lead) return false;
  if (user.role === 'admin') return true;
  return String(lead.agentId) === String(user.id);
};

export const followUpsController = {
  async list(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { leadId, status } = req.query;

      if (leadId) {
        const lead = await leadsModel.findById(String(leadId));
        if (!lead) {
          return res.status(404).json({ message: 'Lead not found' });
        }
        if (!ensureLeadAccess(lead, req.user)) {
          return res.status(403).json({ message: 'You do not have access to this lead' });
        }
        const rows = await followUpsModel.findByLead(String(leadId));
        return res.json(rows);
      }

      const rows = req.user.role === 'admin'
        ? await followUpsModel.findAll(status ? String(status) : undefined)
        : await followUpsModel.findAllByAssignee(req.user.id, status ? String(status) : undefined);
      res.json(rows);
    } catch (error) {
      next(error);
    }
  },

  async create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const payload = validatePayload(followUpSchema, {
        ...req.body,
        assignedTo: req.body.assignedTo || req.user.id
      });
      const item = await followUpsModel.create(payload);
      // create an in-app notification to inform the assignee about the scheduled follow-up
      try {
        const msg = `Follow-up scheduled for lead ${item.lead_id} on ${new Date(item.due_date).toLocaleString()}`;
        const created = await notificationsModel.create({
          userId: item.assigned_to,
          leadId: item.lead_id,
          type: 'followup_scheduled',
          message: msg,
          payload: { followUpId: item.id, dueDate: item.due_date }
        });
        try { sendToUser(String(item.assigned_to), 'notification', created); } catch(e) {}
      } catch (nerr) {
        console.error('[FollowUps] failed to create notification', nerr);
      }
      // log activity
      try {
        await logActivity({
          userId: req.user.id,
          entityType: 'follow_up',
          entityId: item.id,
          action: 'create',
          changes: { title: item.title, dueDate: item.due_date, assignedTo: item.assigned_to }
        });
      } catch (e) {
        // logging failure should not block
      }
      res.status(201).json(item);
    } catch (error) {
      next(error);
    }
  },

  async update(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const payload = validatePayload(followUpSchema.fork(['leadId','title','dueDate'], (s) => s.optional()), req.body) as any;
      if (payload.status === 'completed' && !payload.completedAt) {
        payload.completedAt = new Date().toISOString();
      }

      const item = await followUpsModel.update(req.params.id, payload);
      if (!item) {
        return res.status(404).json({ message: 'Follow-up not found' });
      }
      try {
        await logActivity({
          userId: req.user.id,
          entityType: 'follow_up',
          entityId: req.params.id,
          action: 'update',
          changes: payload as Record<string, any>
        });
      } catch (_) {}
      res.json(item);
    } catch (error) {
      next(error);
    }
  },

  async delete(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const item = await followUpsModel.delete(req.params.id);
      if (!item) {
        return res.status(404).json({ message: 'Follow-up not found' });
      }
      try {
        await logActivity({
          userId: req.user.id,
          entityType: 'follow_up',
          entityId: req.params.id,
          action: 'delete'
        });
      } catch (_) {}
      res.json({ message: 'Deleted', item });
    } catch (error) {
      next(error);
    }
  },

  async complete(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const item = await followUpsModel.markDone(req.params.id);
      if (!item) {
        return res.status(404).json({ message: 'Follow-up not found' });
      }
      try {
        await logActivity({
          userId: req.user.id,
          entityType: 'follow_up',
          entityId: req.params.id,
          action: 'complete'
        });
      } catch (_) {}
      res.json(item);
    } catch (error) {
      next(error);
    }
  },

  async cancel(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { reason } = req.body as { reason?: string };
      const item = await followUpsModel.cancel(req.params.id, {
        canceledReason: reason || '',
        canceledBy: req.user.id
      });
      if (!item) {
        return res.status(404).json({ message: 'Follow-up not found' });
      }
      try {
        await logActivity({
          userId: req.user.id,
          entityType: 'follow_up',
          entityId: req.params.id,
          action: 'cancel',
          changes: { reason: reason || '' }
        });
      } catch (_) {}
      res.json(item);
    } catch (error) {
      next(error);
    }
  }
};
