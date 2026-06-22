import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { quoteRequestsModel } from '../models/QuoteRequest';
import { leadsModel } from '../models/Lead';
import { notificationsModel } from '../models/Notification';
import { sendToUser } from '../utils/wsServer';
import { query } from '../utils/database';
import { logActivity } from '../utils/activity-log';
import { generateQuotationNumber } from '../services/quotation-number-service';

export const quoteRequestsController = {
  async requestQuote(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const leadId = req.params.id;
      const { requestType = 'quotation' } = req.body;

      if (!['quotation', 'invoice'].includes(requestType)) {
        return res.status(400).json({ message: 'Invalid request type' });
      }

      const lead = await leadsModel.findById(leadId);
      if (!lead) {
        return res.status(404).json({ message: 'Lead not found' });
      }

      if (req.user.role !== 'agent') {
        return res.status(403).json({ message: 'Only agents can request quotations or invoices' });
      }

      if (lead.agentId !== req.user.id) {
        return res.status(403).json({ message: 'You can only request documents for your own leads' });
      }

      const quoteRequest = await quoteRequestsModel.create({
        leadId,
        requestedBy: req.user.id,
        requestType,
        status: 'requested'
      });

      const managers = await query('SELECT id, name, email FROM users WHERE role = $1', ['manager']);
      const recipients = managers.rows.length ? managers.rows : (await query('SELECT id, name, email FROM users WHERE role = $1', ['admin'])).rows;
      const actorLabel = req.user.email || 'Agent';
      const notificationMessage = `Quote request: ${actorLabel} requested a ${requestType} for ${lead.clientName || lead.phone}`;

      for (const recipient of recipients) {
        const notification = await notificationsModel.create({
          userId: recipient.id,
          leadId: lead.id,
          type: 'quote_request',
          message: notificationMessage,
          payload: {
            requestId: quoteRequest.id,
            leadId: lead.id,
            requestType,
            requestedBy: req.user.id,
            requestedByEmail: req.user.email,
            leadName: lead.clientName,
            leadPhone: lead.phone
          },
          is_read: false
        });

        sendToUser(recipient.id, 'notification', notification);
      }

      try {
        await logActivity({
          userId: req.user.id,
          entityType: 'quote_request',
          entityId: quoteRequest.id,
          action: 'create',
          changes: { requestType }
        });
      } catch (_) {}

      res.status(201).json(quoteRequest);
    } catch (error) {
      next(error);
    }
  },

  async listByUser(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id: userId, role } = req.user;
      const requests = await quoteRequestsModel.findAccessibleByUser(userId, role);
      res.json(requests);
    } catch (error) {
      next(error);
    }
  },

  async getById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const requestId = String(req.params.id || '');
      const request = await quoteRequestsModel.findById(requestId);
      if (!request) {
        return res.status(404).json({ message: 'Quote request not found' });
      }

      if (req.user.role === 'admin' || req.user.role === 'manager') {
        return res.json(request);
      }

      const lead = await leadsModel.findById(request.leadId);
      if (!lead || lead.agentId !== req.user.id) {
        return res.status(403).json({ message: 'Access denied' });
      }

      res.json(request);
    } catch (error) {
      next(error);
    }
  },

  async listPending(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const pendingRequests = await quoteRequestsModel.findPending();
      res.json(pendingRequests);
    } catch (error) {
      next(error);
    }
  },

  async saveRequest(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const requestId = req.params.id;
      const { documentData } = req.body;

      if (!documentData) {
        return res.status(400).json({ message: 'Missing document data' });
      }

      if (req.user.role !== 'manager') {
        return res.status(403).json({ message: 'Only managers can save quote requests' });
      }

      const existingRequest = await quoteRequestsModel.findById(requestId);
      if (!existingRequest) {
        return res.status(404).json({ message: 'Quote request not found' });
      }

      // Generate quotation number if this is a quotation
      let quotationNumber = documentData.quoteNumber || null;
      if (existingRequest.requestType === 'quotation' && !quotationNumber) {
        const referenceDate = documentData.date ? new Date(documentData.date) : new Date();
        quotationNumber = await generateQuotationNumber(referenceDate);
      }

      const updatedRequest = await quoteRequestsModel.update(requestId, {
        status: 'saved',
        documentData: {
          ...documentData,
          quoteNumber: quotationNumber
        },
        resolvedBy: req.user.id,
        resolvedAt: new Date().toISOString()
      });

      const lead = await leadsModel.findById(existingRequest.leadId);
      if (lead) {
        const admins = await query('SELECT id, name, email FROM users WHERE role = $1', ['admin']);
        const notificationMessage = `Saved quote ready for approval: ${req.user.email || 'Manager'} saved a ${existingRequest.requestType} for ${lead.clientName || lead.phone}`;

        for (const admin of admins.rows) {
          const notification = await notificationsModel.create({
            userId: admin.id,
            leadId: lead.id,
            type: 'quote_saved_for_approval',
            message: notificationMessage,
            payload: {
              requestId: updatedRequest.id,
              leadId: lead.id,
              requestType: updatedRequest.requestType,
              savedBy: req.user.id,
              savedByEmail: req.user.email,
              quotationNumber
            },
            is_read: false
          });
          sendToUser(admin.id, 'notification', notification);
        }
      }
      try {
        await logActivity({
          userId: req.user.id,
          entityType: 'quote_request',
          entityId: updatedRequest.id,
          action: 'save',
          changes: { resolvedBy: req.user.id, quotationNumber }
        });
      } catch (_) {}

      res.json(updatedRequest);
    } catch (error) {
      next(error);
    }
  },

  async deleteRequest(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const requestId = req.params.id;

      const existingRequest = await quoteRequestsModel.findById(requestId);
      if (!existingRequest) {
        return res.status(404).json({ message: 'Quote request not found' });
      }

      // Only the agent who requested it can delete their own request
      if (req.user.role === 'agent' && existingRequest.requestedBy !== req.user.id) {
        return res.status(403).json({ message: 'You can only delete your own quote requests' });
      }

      // Manager or admin can delete any request
      if (req.user.role !== 'agent' && req.user.role !== 'manager' && req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Unauthorized' });
      }

      const deletedRequest = await quoteRequestsModel.delete(requestId);
      
      // Notify admin if agent deleted
      if (req.user.role === 'agent') {
        const admins = await query('SELECT id FROM users WHERE role = $1', ['admin']);
        const lead = await leadsModel.findById(existingRequest.leadId);
        const message = `Quote request deleted by agent for ${lead?.clientName || lead?.phone || 'unknown'}`;
        
        for (const admin of admins.rows) {
          const notification = await notificationsModel.create({
            userId: admin.id,
            leadId: existingRequest.leadId,
            type: 'quote_deleted',
            message,
            payload: {
              requestId,
              leadId: existingRequest.leadId,
              requestType: existingRequest.requestType
            },
            is_read: false
          });
          sendToUser(admin.id, 'notification', notification);
        }
      }

      try {
        await logActivity({
          userId: req.user.id,
          entityType: 'quote_request',
          entityId: requestId,
          action: 'delete'
        });
      } catch (_) {}

      res.json(deletedRequest);
    } catch (error) {
      next(error);
    }
  },

  async reRequestQuote(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const requestId = req.params.id;
      const { notes } = req.body;

      if (!notes || notes.trim() === '') {
        return res.status(400).json({ message: 'Please provide notes for the re-request' });
      }

      const existingRequest = await quoteRequestsModel.findById(requestId);
      if (!existingRequest) {
        return res.status(404).json({ message: 'Quote request not found' });
      }

      // Only agent can re-request
      if (req.user.role !== 'agent') {
        return res.status(403).json({ message: 'Only agents can re-request quotations' });
      }

      const lead = await leadsModel.findById(existingRequest.leadId);
      if (!lead || lead.agentId !== req.user.id) {
        return res.status(403).json({ message: 'You can only re-request documents for your own leads' });
      }

      // Create new re-request with notes
      const newRequest = await quoteRequestsModel.create({
        leadId: existingRequest.leadId,
        requestedBy: req.user.id,
        requestType: existingRequest.requestType,
        status: 'requested',
        reRequestNotes: notes.trim(),
        parentRequestId: requestId
      });

      // Notify admins
      const admins = await query('SELECT id, name, email FROM users WHERE role = $1', ['admin']);
      const actorLabel = req.user.email || 'Agent';
      const notificationMessage = `Re-request: ${actorLabel} re-requested a ${existingRequest.requestType} for ${lead.clientName || lead.phone}`;

      for (const admin of admins.rows) {
        const notification = await notificationsModel.create({
          userId: admin.id,
          leadId: lead.id,
          type: 'quote_re_request',
          message: notificationMessage,
          payload: {
            requestId: newRequest.id,
            parentRequestId: requestId,
            leadId: lead.id,
            requestType: existingRequest.requestType,
            notes,
            requestedBy: req.user.id,
            requestedByEmail: req.user.email
          },
          is_read: false
        });

        sendToUser(admin.id, 'notification', notification);
      }
        try {
          await logActivity({
            userId: req.user.id,
            entityType: 'quote_request',
            entityId: newRequest.id,
            action: 're-request',
            changes: { parentRequestId: requestId }
          });
        } catch (_) {}

      res.status(201).json(newRequest);
    } catch (error) {
      next(error);
    }
  },

  async approveRequest(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const requestId = req.params.id;
      const existingRequest = await quoteRequestsModel.findById(requestId);
      if (!existingRequest) {
        return res.status(404).json({ message: 'Quote request not found' });
      }

      if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Only admins can approve quote requests' });
      }

      if (existingRequest.status !== 'saved') {
        return res.status(400).json({ message: 'Only saved quote requests can be approved' });
      }

      const updatedRequest = await quoteRequestsModel.update(requestId, {
        status: 'approved',
        approvedBy: req.user.id,
        approvedAt: new Date().toISOString()
      });

      const lead = await leadsModel.findById(existingRequest.leadId);
      if (lead) {
        const notification = await notificationsModel.create({
          userId: existingRequest.requestedBy,
          leadId: lead.id,
          type: 'quote_saved',
          message: `Your ${existingRequest.requestType} has been approved by admin for ${lead.clientName || lead.phone}`,
          payload: {
            requestId: updatedRequest.id,
            leadId: lead.id,
            requestType: updatedRequest.requestType,
            quotationNumber: updatedRequest.documentData?.quoteNumber
          },
          is_read: false
        });
        sendToUser(existingRequest.requestedBy, 'notification', notification);
      }

      try {
        await logActivity({
          userId: req.user.id,
          entityType: 'quote_request',
          entityId: updatedRequest.id,
          action: 'approve',
          changes: { approvedBy: req.user.id }
        });
      } catch (_) {}

      res.json(updatedRequest);
    } catch (error) {
      next(error);
    }
  },

  async getNextQuotationNumber(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Only admins can generate quotation numbers' });
      }

      const { date } = req.query;
      const referenceDate = date ? new Date(String(date)) : new Date();
      
      if (isNaN(referenceDate.getTime())) {
        return res.status(400).json({ message: 'Invalid date provided' });
      }

      const quotationNumber = await generateQuotationNumber(referenceDate);
      
      res.json({ quotationNumber });
    } catch (error) {
      next(error);
    }
  },

  // Manager approval workflow methods
  async getPendingForManager(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (req.user.role !== 'manager') {
        return res.status(403).json({ message: 'Only managers can view pending requests' });
      }

      const requests = await quoteRequestsModel.findPendingForManager();
      res.json(requests);
    } catch (error) {
      next(error);
    }
  },

  async createQuotationByManager(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (req.user.role !== 'manager') {
        return res.status(403).json({ message: 'Only managers can create quotations' });
      }

      const { id } = req.params;
      const { documentData, managerNotes } = req.body;

      const quoteRequest = await quoteRequestsModel.findById(id);
      if (!quoteRequest) {
        return res.status(404).json({ message: 'Quote request not found' });
      }

      if (quoteRequest.status !== 'requested') {
        return res.status(400).json({ message: 'This quote request is not pending manager action' });
      }

      const updatedRequest = await quoteRequestsModel.updateByManager(id, req.user.id, {
        documentData,
        managerNotes
      });

      // Notify admins about pending approval
      const admins = await query('SELECT id, name, email FROM users WHERE role = $1', ['admin']);
      for (const admin of admins.rows) {
        const notification = await notificationsModel.create({
          userId: admin.id,
          leadId: quoteRequest.leadId,
          type: 'quotation_pending_approval',
          message: `Manager ${req.user.name || req.user.email} created a quotation for ${quoteRequest.leadClientName} awaiting approval`
        });
        sendToUser(admin.id, 'notification', notification);
      }

      try {
        await logActivity({
          userId: req.user.id,
          entityType: 'quote_request',
          entityId: id,
          action: 'create_quotation',
          changes: { status: 'admin_pending', createdByManager: req.user.id }
        });
      } catch (_) {}

      res.json(updatedRequest);
    } catch (error) {
      next(error);
    }
  },

  // Admin approval workflow methods
  async getPendingForAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Only admins can view pending approvals' });
      }

      const requests = await quoteRequestsModel.findPendingForAdmin();
      res.json(requests);
    } catch (error) {
      next(error);
    }
  },

  async approveQuotation(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Only admins can approve quotations' });
      }

      const { id } = req.params;

      const quoteRequest = await quoteRequestsModel.findById(id);
      if (!quoteRequest) {
        return res.status(404).json({ message: 'Quote request not found' });
      }

      if (quoteRequest.status !== 'admin_pending') {
        return res.status(400).json({ message: 'This quote request is not pending admin approval' });
      }

      const approvedRequest = await quoteRequestsModel.approveByAdmin(id, req.user.id);

      // Notify the requesting agent
      const notification = await notificationsModel.create({
        userId: quoteRequest.requestedBy,
        leadId: quoteRequest.leadId,
        type: 'quotation_approved',
        message: `Your ${quoteRequest.requestType} for ${quoteRequest.leadClientName} has been approved`
      });
      sendToUser(quoteRequest.requestedBy, 'notification', notification);

      try {
        await logActivity({
          userId: req.user.id,
          entityType: 'quote_request',
          entityId: id,
          action: 'approve_quotation',
          changes: { status: 'approved', approvedBy: req.user.id }
        });
      } catch (_) {}

      res.json(approvedRequest);
    } catch (error) {
      next(error);
    }
  },

  async rejectQuotation(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Only admins can reject quotations' });
      }

      const { id } = req.params;
      const { rejectionReason } = req.body;

      if (!rejectionReason) {
        return res.status(400).json({ message: 'Rejection reason is required' });
      }

      const quoteRequest = await quoteRequestsModel.findById(id);
      if (!quoteRequest) {
        return res.status(404).json({ message: 'Quote request not found' });
      }

      if (quoteRequest.status !== 'admin_pending') {
        return res.status(400).json({ message: 'This quote request is not pending admin approval' });
      }

      const rejectedRequest = await quoteRequestsModel.rejectByAdmin(id, req.user.id, rejectionReason);

      // Notify the manager to revise
      if (quoteRequest.createdByManager) {
        const notification = await notificationsModel.create({
          userId: quoteRequest.createdByManager,
          leadId: quoteRequest.leadId,
          type: 'quotation_rejected',
          message: `Your quotation for ${quoteRequest.leadClientName} was rejected: ${rejectionReason}`
        });}
        sendToUser(quoteRequest.createdByManager, 'notification', notification);
      }

      try {
        await logActivity({
          userId: req.user.id,
          entityType: 'quote_request',
          entityId: id,
          action: 'reject_quotation',
          changes: { status: 'rejected', rejectedBy: req.user.id, rejectionReason }
        });
      } catch (_) {}

      res.json(rejectedRequest);
    } catch (error) {
      next(error);
    }
  }
};
