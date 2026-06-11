import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { quoteRequestsModel } from '../models/QuoteRequest';
import { leadsModel } from '../models/Lead';
import { notificationsModel } from '../models/Notification';
import { sendToUser } from '../utils/wsServer';
import { query } from '../utils/database';

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

      const admins = await query('SELECT id, name, email FROM users WHERE role = $1', ['admin']);
      const actorLabel = req.user.email || 'Agent';
      const notificationMessage = `Quote request: ${actorLabel} requested a ${requestType} for ${lead.clientName || lead.phone}`;

      for (const admin of admins.rows) {
        const notification = await notificationsModel.create({
          userId: admin.id,
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

        sendToUser(admin.id, 'notification', notification);
      }

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

      if (req.user.role === 'admin') {
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

      if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Only admins can save quote requests' });
      }

      const existingRequest = await quoteRequestsModel.findById(requestId);
      if (!existingRequest) {
        return res.status(404).json({ message: 'Quote request not found' });
      }

      const updatedRequest = await quoteRequestsModel.update(requestId, {
        status: 'saved',
        documentData,
        resolvedBy: req.user.id,
        resolvedAt: new Date().toISOString()
      });

      const lead = await leadsModel.findById(existingRequest.leadId);
      if (lead) {
        const notification = await notificationsModel.create({
          userId: existingRequest.requestedBy,
          leadId: lead.id,
          type: 'quote_saved',
          message: `Your ${existingRequest.requestType} has been saved by admin for ${lead.clientName || lead.phone}`,
          payload: {
            requestId: updatedRequest.id,
            leadId: lead.id,
            requestType: updatedRequest.requestType
          },
          is_read: false
        });
        sendToUser(existingRequest.requestedBy, 'notification', notification);
      }

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

      // Admin can delete any request
      if (req.user.role !== 'agent' && req.user.role !== 'admin') {
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

      res.status(201).json(newRequest);
    } catch (error) {
      next(error);
    }
  }
};
