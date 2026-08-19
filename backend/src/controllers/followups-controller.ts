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
  if (user.role === 'admin' || user.role === 'manager') return true;
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

      const rows = req.user.role === 'admin' || req.user.role === 'manager'
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
        assignedTo: req.body.assignedTo || req.user.id,
        createdBy: req.user.id
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
      try {
        await leadsModel.touch(item.lead_id);
      } catch (_) {}
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
      const payload = validatePayload(followUpSchema.fork(['leadId','title','description','dueDate'], (s) => s.optional()), req.body) as any;
      if (payload.status === 'completed' && !payload.completedAt) {
        const existing = await followUpsModel.findById(req.params.id);
        if (!existing) {
          return res.status(404).json({ message: 'Follow-up not found' });
        }
        if (!String(existing.action_plan || '').trim()) {
          return res.status(400).json({ message: 'Action plan is required before completing this follow-up' });
        }
        payload.completedAt = new Date().toISOString();
      }

      const item = await followUpsModel.update(req.params.id, payload);
      if (!item) {
        return res.status(404).json({ message: 'Follow-up not found' });
      }
      try {
        await leadsModel.touch(item.lead_id);
      } catch (_) {}
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

  async saveActionPlan(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const actionPlan = typeof req.body?.actionPlan === 'string' ? req.body.actionPlan.trim() : '';
      if (!actionPlan) {
        return res.status(400).json({ message: 'Action plan is required' });
      }

      const item = await followUpsModel.saveActionPlan(req.params.id, actionPlan);
      if (!item) {
        return res.status(404).json({ message: 'Follow-up not found' });
      }

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
      const { remarks } = req.body as { remarks?: string };

      const existing = await followUpsModel.findById(req.params.id);
      if (!existing) {
        return res.status(404).json({ message: 'Follow-up not found' });
      }
      if (!String(existing.action_plan || '').trim()) {
        return res.status(400).json({ message: 'Action plan is required before completing this follow-up' });
      }
      
      const item = await followUpsModel.markDoneWithNotes(req.params.id, remarks);
      if (!item) {
        return res.status(404).json({ message: 'Follow-up not found' });
      }

      try {
        await leadsModel.touch(item.lead_id);
      } catch (_) {}

      // If remarks provided, update the associated lead's agent_remarks
      if (remarks && item.lead_id) {
        try {
          const updatedLead = await leadsModel.update(item.lead_id, {
            agentRemarks: remarks
          });
        } catch (err) {
          console.error('Failed to update lead remarks:', err);
        }
      }

      try {
        await logActivity({
          userId: req.user.id,
          entityType: 'follow_up',
          entityId: req.params.id,
          action: 'complete',
          changes: { completionNotes: remarks || '' }
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
        await leadsModel.touch(item.lead_id);
      } catch (_) {}
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
