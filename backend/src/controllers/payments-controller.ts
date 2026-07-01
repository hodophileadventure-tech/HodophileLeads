import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { paymentsModel } from '../models/Payment';
import { leadsModel } from '../models/Lead';
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
      const lead = await leadsModel.findById(payload.leadId);
      const actualPrice = Number((lead as any)?.actualPrice ?? (lead as any)?.actual_price ?? 0);
      if (!actualPrice || actualPrice <= 0) {
        console.warn('[Payments] Rejected deposit creation because lead has no accepted actual price.', {
          leadId: payload.leadId,
          userId: req.user.id
        });
        return res.status(400).json({ message: 'Accepted quotation is required before recording deposits' });
      }

      const existingPayments = await paymentsModel.findAllByLead(payload.leadId);
      const totalDeposits = existingPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
      const nextTotal = totalDeposits + Number(payload.amount || 0);
      if (nextTotal > actualPrice) {
        return res.status(400).json({ message: 'Deposit cannot exceed the accepted quotation actual price' });
      }

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
      const existingPayment = await paymentsModel.findById(req.params.id);
      if (existingPayment) {
        const lead = await leadsModel.findById(existingPayment.leadId);
        const actualPrice = Number((lead as any)?.actualPrice ?? (lead as any)?.actual_price ?? 0);
        if (actualPrice <= 0) {
          console.warn('[Payments] Rejected deposit update because lead has no accepted actual price.', {
            paymentId: req.params.id,
            leadId: existingPayment.leadId,
            userId: req.user.id
          });
          return res.status(400).json({ message: 'Accepted quotation is required before recording deposits' });
        }

        const currentPayments = await paymentsModel.findAllByLead(existingPayment.leadId);
        const otherPaymentsTotal = currentPayments
          .filter((payment) => payment.id !== req.params.id)
          .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
        const proposedAmount = Number(req.body?.amount ?? existingPayment.amount ?? 0);
        if (otherPaymentsTotal + proposedAmount > actualPrice) {
          return res.status(400).json({ message: 'Deposit cannot exceed the accepted quotation actual price' });
        }
      }

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
