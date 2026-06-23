import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { paymentsModel } from '../models/Payment';
import { validatePayload, paymentSchema } from '../utils/validation';
import { logActivity } from '../utils/activity-log';

export const paymentsController = {
  async list(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { leadId } = req.query;
      if (!leadId || typeof leadId !== 'string') {
        return res.status(400).json({ message: 'leadId query parameter is required' });
      }
      const rows = await paymentsModel.findAllByLead(leadId);
      res.json(rows);
    } catch (error) {
      next(error);
    }
  },

  async create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const payload = validatePayload(paymentSchema, req.body);
      const item = await paymentsModel.create(payload);
      try {
        await logActivity({
          userId: req.user.id,
          entityType: 'payment',
          entityId: item.id,
          action: 'create',
          changes: { amount: item.amount, leadId: item.lead_id }
        });
      } catch (_) {}
      res.status(201).json(item);
    } catch (error) {
      next(error);
    }
  },

  async update(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const item = await paymentsModel.update(req.params.id, req.body || {});
      if (!item) {
        return res.status(404).json({ message: 'Payment not found' });
      }
      res.json(item);
    } catch (error) {
      next(error);
    }
  },

  async confirm(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const proofUrl = (req as any).file ? `/uploads/payment-proofs/${(req as any).file.filename}` : req.body?.proofUrl;
      console.log('Confirming payment:', req.params.id, 'with proof:', proofUrl);
      const item = await paymentsModel.confirm(req.params.id, req.body?.paidDate, proofUrl);
      if (!item) {
        return res.status(404).json({ message: 'Payment not found' });
      }
      try {
        await logActivity({
          userId: req.user.id,
          entityType: 'payment',
          entityId: req.params.id,
          action: 'confirm',
          changes: { proofUrl }
        });
      } catch (_) {}
      res.json(item);
    } catch (error) {
      next(error);
    }
  },

  async delete(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const item = await paymentsModel.delete(req.params.id);
      if (!item) {
        return res.status(404).json({ message: 'Payment not found' });
      }
      try {
        await logActivity({
          userId: req.user.id,
          entityType: 'payment',
          entityId: req.params.id,
          action: 'delete'
        });
      } catch (_) {}
      res.json({ message: 'Deleted', item });
    } catch (error) {
      next(error);
    }
  }
};
