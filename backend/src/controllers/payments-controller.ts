import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { paymentsModel } from '../models/Payment';
import { leadsModel } from '../models/Lead';
import { validatePayload, paymentSchema } from '../utils/validation';
import { logActivity } from '../utils/activity-log';
import { query } from '../utils/database';

const resolveAcceptedLeadPrice = async (leadId: string, lead: any) => {
  try {
    const invoiceResult = await query(
      `SELECT document_data
       FROM quote_requests
       WHERE lead_id = $1
         AND request_type = 'invoice'
         AND accepted_at IS NOT NULL
       ORDER BY accepted_at DESC, updated_at DESC
       LIMIT 1`,
      [leadId]
    );

    const invoiceDocument = invoiceResult.rows?.[0]?.document_data || invoiceResult.rows?.[0]?.documentData || null;
    const invoiceSubtotal = invoiceDocument ? Number(String(invoiceDocument.subtotal ?? invoiceDocument.total ?? invoiceDocument.totalDue ?? invoiceDocument.grandTotal ?? '0').replace(/[^0-9.\-]/g, '')) : NaN;
    if (invoiceDocument && Number.isFinite(invoiceSubtotal) && invoiceSubtotal > 0) {
      return invoiceSubtotal;
    }
  } catch (error) {
    console.warn('[Payments] Failed to resolve accepted invoice subtotal for lead:', leadId, error);
  }

  return Number(
    (lead as any)?.actualPrice ??
    (lead as any)?.actual_price ??
    (lead as any)?.latestRevisedPrice ??
    (lead as any)?.latest_revised_price ??
    (lead as any)?.initialPrice ??
    (lead as any)?.initial_price ??
    0
  );
};

const touchLead = async (leadId?: string) => {
  if (!leadId) return;
  try {
    await leadsModel.touch(leadId);
  } catch (_) {}
};

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
      const actualPrice = await resolveAcceptedLeadPrice(payload.leadId, lead);
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
      await touchLead(payload.leadId);
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
        const actualPrice = await resolveAcceptedLeadPrice(existingPayment.leadId, lead);
        if (actualPrice <= 0) {
          console.warn('[Payments] Rejected deposit update because lead has no accepted actual price.', {
            paymentId: req.params.id,
            leadId: existingPayment.leadId,
            userId: req.user.id
          });
          return res.status(400).json({ message: 'Accepted quotation or invoice is required before recording deposits' });
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
      await touchLead(existingPayment.leadId);
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
      await touchLead(item.leadId);
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
      await touchLead(item.leadId);
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
