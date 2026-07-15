import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { quoteRequestsModel } from '../models/QuoteRequest';
import { leadsModel } from '../models/Lead';
import { notificationsModel } from '../models/Notification';
import { sendToUser } from '../utils/wsServer';
import { query, getClient } from '../utils/database';
import { repairPendingQuotationNumbers } from '../utils/database';
import { logActivity } from '../utils/activity-log';
import { generateQuotationNumber, peekNextQuotationNumber } from '../services/quotation-number-service';
import { resolveQuotationSubtotal, setLeadActualPrice, syncLeadQuotationPricing } from '../services/quotation-pricing-sync-service';

const getExplicitSubtotal = (documentData: any): number | null => resolveQuotationSubtotal(documentData).subtotal;

const resolveUniqueQuotationNumber = async (
  requestId: string,
  proposedQuotationNumber: string | null,
  client?: any
) => {
  if (proposedQuotationNumber) {
    const normalizedQuotationNumber = String(proposedQuotationNumber).trim();
    const conflict = client
      ? await client.query(
          `SELECT 1
           FROM quote_requests
           WHERE COALESCE(quotation_number, document_data->>'quoteNumber') = $1
             AND id <> $2
           LIMIT 1`,
          [normalizedQuotationNumber, requestId]
        )
      : await query(
          `SELECT 1
           FROM quote_requests
           WHERE COALESCE(quotation_number, document_data->>'quoteNumber') = $1
             AND id <> $2
           LIMIT 1`,
          [normalizedQuotationNumber, requestId]
        );

    if (!conflict.rows.length) {
      return normalizedQuotationNumber;
    }
  }

  return generateQuotationNumber(undefined, client);
};

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

      const client = await getClient();
      let quoteRequest;
      try {
        await client.query('BEGIN');

        const quotationNumber = requestType === 'quotation' ? await generateQuotationNumber(undefined, client) : null;
        quoteRequest = await quoteRequestsModel.create({
          leadId,
          requestedBy: req.user.id,
          requestType,
          status: 'requested',
          quotationNumber
        }, client);

        await client.query('COMMIT');
      } catch (error) {
        try {
          await client.query('ROLLBACK');
        } catch (_) {}
        throw error;
      } finally {
        client.release();
      }

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
      await repairPendingQuotationNumbers();
      const { id: userId, role } = req.user;
      const requests = await quoteRequestsModel.findAccessibleByUser(userId, role);
      res.json(requests);
    } catch (error) {
      next(error);
    }
  },

  async getById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      await repairPendingQuotationNumbers();
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
      await repairPendingQuotationNumbers();
      let pendingRequests;

      if (req.user.role === 'agent') {
        // Agents see only quote requests for their own leads
        pendingRequests = await quoteRequestsModel.findPendingByAgent(req.user.id);
      } else {
        // Managers and admins see all pending requests
        pendingRequests = await quoteRequestsModel.findPending();
      }

      res.json(pendingRequests);
    } catch (error) {
      next(error);
    }
  },

  async saveRequest(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const requestId = req.params.id;
      let { documentData } = req.body;

      if (!documentData) {
        return res.status(400).json({ message: 'Missing document data' });
      }

      if (req.user.role !== 'manager' && req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Only admins and managers can save quote requests' });
      }

      const existingRequest = await quoteRequestsModel.findById(requestId);
      if (!existingRequest) {
        return res.status(404).json({ message: 'Quote request not found' });
      }

      const existingQuotationNumber = existingRequest.quotationNumber || null;
      let quotationNumber = existingQuotationNumber;
      const isQuotation = existingRequest.requestType === 'quotation';
      const isAdminCreatedQuotation = req.user.role === 'admin' && isQuotation;
      const isManagerCreatedQuotation = req.user.role === 'manager' && isQuotation;

      const existingAcceptedSubtotal = existingRequest.acceptedAt ? getExplicitSubtotal(existingRequest.documentData) : null;
      const proposedSubtotal = getExplicitSubtotal(documentData);
      if (existingRequest.acceptedAt) {
        if (proposedSubtotal !== null && existingAcceptedSubtotal !== null && proposedSubtotal !== existingAcceptedSubtotal) {
          return res.status(409).json({ message: 'Accepted quotation subtotal is immutable' });
        }
        if (existingAcceptedSubtotal !== null && proposedSubtotal === null) {
          documentData = {
            ...documentData,
            subtotal: String(existingAcceptedSubtotal)
          };
        }
      }

      const client = await getClient();
      let updatedRequest;
      try {
        await client.query('BEGIN');

        if (isQuotation) {
          const referenceDate = documentData.date ? new Date(documentData.date) : new Date();
          quotationNumber = await resolveUniqueQuotationNumber(requestId, quotationNumber, client);
        }

        const savedDocumentData = {
          ...documentData,
          quoteNumber: quotationNumber
        };

        const updatePayload: Partial<typeof existingRequest> = {
          quotationNumber,
          documentData: savedDocumentData,
          resolvedBy: req.user.id,
          resolvedAt: new Date().toISOString(),
        };

        if (req.user.role === 'manager') {
          Object.assign(updatePayload, {
            status: 'admin_pending' as const,
          });
        } else if (isAdminCreatedQuotation) {
          Object.assign(updatePayload, {
            status: 'created' as const,
          });
        } else {
          Object.assign(updatePayload, {
            status: 'saved' as const,
          });
        }

        updatedRequest = await quoteRequestsModel.update(requestId, updatePayload, client);

        if (isQuotation && !existingRequest.acceptedAt) {
          try {
            await syncLeadQuotationPricing(existingRequest.leadId, savedDocumentData, { markAccepted: false }, client);
          } catch (syncError) {
            console.error('[Quotation Save] Failed to sync lead pricing after save, continuing with saved quotation:', syncError);
          }
        }

        await client.query('COMMIT');
      } catch (error) {
        try {
          await client.query('ROLLBACK');
        } catch (_) {}
        throw error;
      } finally {
        client.release();
      }

      let lead = null;
      try {
        lead = await leadsModel.findById(existingRequest.leadId);
      } catch (leadError) {
        console.error('[Quotation Save] Failed to refetch lead after save:', leadError);
      }

      if (lead) {
        try {
          if (isAdminCreatedQuotation) {
            const notification = await notificationsModel.create({
              userId: existingRequest.requestedBy,
              leadId: lead.id,
              type: 'quote_saved',
              message: `Your ${existingRequest.requestType} for ${lead.clientName || lead.phone} is ready`,
              payload: {
                requestId: updatedRequest.id,
                leadId: lead.id,
                requestType: updatedRequest.requestType,
                quotationNumber,
                savedBy: req.user.id,
                savedByEmail: req.user.email
              },
              is_read: false
            });
            sendToUser(existingRequest.requestedBy, 'notification', notification);
          } else {
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
        } catch (notificationError) {
          console.error('[Quotation Save] Failed to create notifications after save:', notificationError);
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

      const leadSnapshot = lead ? {
        ...lead,
        initialPrice: (lead as any).initialPrice ?? (lead as any).initial_price ?? getExplicitSubtotal(documentData),
        latestRevisedPrice: (lead as any).latestRevisedPrice ?? (lead as any).latest_revised_price ?? getExplicitSubtotal(documentData),
        actualPrice: (lead as any).actualPrice ?? (lead as any).actual_price ?? null
      } : null;

      res.json({ ...updatedRequest, lead: leadSnapshot });
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

  async sendForApproval(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const requestId = req.params.id;
      const { notes } = req.body;

      if (req.user.role !== 'manager') {
        return res.status(403).json({ message: 'Only managers can send quotations for approval' });
      }

      const quoteRequest = await quoteRequestsModel.findById(requestId);
      if (!quoteRequest) {
        return res.status(404).json({ message: 'Quote request not found' });
      }

      if (quoteRequest.status !== 'manager_pending' && quoteRequest.status !== 'saved') {
        return res.status(400).json({ message: 'This quotation cannot be sent for approval in its current status' });
      }

      // Update status to admin_pending
      const updatedRequest = await quoteRequestsModel.update(requestId, {
        status: 'admin_pending',
        managerNotes: notes || quoteRequest.managerNotes
      });

      // Notify admins about pending approval
      const admins = await query('SELECT id, name, email FROM users WHERE role = $1', ['admin']);
      const lead = await leadsModel.findById(quoteRequest.leadId);
      
      for (const admin of admins.rows) {
        const notification = await notificationsModel.create({
          userId: admin.id,
          leadId: quoteRequest.leadId,
          type: 'quotation_pending_approval',
          message: `Manager sent a ${quoteRequest.requestType} for approval - ${lead?.clientName || 'Client'}`,
          payload: {
            requestId: updatedRequest.id,
            leadId: quoteRequest.leadId,
            requestType: updatedRequest.requestType
          },
          is_read: false
        });
        sendToUser(admin.id, 'notification', notification);
      }

      try {
        await logActivity({
          userId: req.user.id,
          entityType: 'quote_request',
          entityId: updatedRequest.id,
          action: 'send_for_approval',
          changes: { status: 'admin_pending' }
        });
      } catch (_) {}

      res.json(updatedRequest);
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
      const client = await getClient();
      let newRequest;
      try {
        await client.query('BEGIN');

        const quotationNumber = existingRequest.requestType === 'quotation' ? await generateQuotationNumber(undefined, client) : null;
        newRequest = await quoteRequestsModel.create({
          leadId: existingRequest.leadId,
          requestedBy: req.user.id,
          requestType: existingRequest.requestType,
          status: 'requested',
          quotationNumber,
          reRequestNotes: notes.trim(),
          parentRequestId: requestId
        }, client);

        await client.query('COMMIT');
      } catch (error) {
        try {
          await client.query('ROLLBACK');
        } catch (_) {}
        throw error;
      } finally {
        client.release();
      }

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

      if (existingRequest.status !== 'saved' && existingRequest.status !== 'created') {
        return res.status(400).json({ message: 'Only saved or created quote requests can be approved' });
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
      if (req.user.role !== 'admin' && req.user.role !== 'manager') {
        return res.status(403).json({ message: 'Only admins and managers can generate quotation numbers' });
      }

      const quotationNumber = await peekNextQuotationNumber();
      
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

      await repairPendingQuotationNumbers();
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
      let { documentData, managerNotes } = req.body;

      if (!documentData) {
        return res.status(400).json({ message: 'Missing document data' });
      }

      const quoteRequest = await quoteRequestsModel.findById(id);
      if (!quoteRequest) {
        return res.status(404).json({ message: 'Quote request not found' });
      }

      if (quoteRequest.status !== 'requested') {
        return res.status(400).json({ message: 'This quote request is not pending manager action' });
      }

      const existingAcceptedSubtotal = quoteRequest.acceptedAt ? getExplicitSubtotal(quoteRequest.documentData) : null;
      const proposedSubtotal = getExplicitSubtotal(documentData);
      if (quoteRequest.acceptedAt) {
        if (proposedSubtotal !== null && existingAcceptedSubtotal !== null && proposedSubtotal !== existingAcceptedSubtotal) {
          return res.status(409).json({ message: 'Accepted quotation subtotal is immutable' });
        }
        if (existingAcceptedSubtotal !== null && proposedSubtotal === null) {
          documentData = {
            ...documentData,
            subtotal: String(existingAcceptedSubtotal)
          };
        }
      }

      const client = await getClient();
      let updatedRequest;
      try {
        await client.query('BEGIN');

        const existingQuotationNumber = quoteRequest.quotationNumber || null;
        const quotationNumber = await resolveUniqueQuotationNumber(id, existingQuotationNumber, client);
        const savedDocumentData = {
          ...documentData,
          quoteNumber: quotationNumber
        };

        updatedRequest = await quoteRequestsModel.updateByManager(id, req.user.id, {
          quotationNumber,
          documentData: savedDocumentData,
          managerNotes
        }, client);

        if (quoteRequest.requestType === 'quotation' && !quoteRequest.acceptedAt) {
          await syncLeadQuotationPricing(quoteRequest.leadId, savedDocumentData, { markAccepted: false }, client);
        }

        await client.query('COMMIT');
      } catch (error) {
        try {
          await client.query('ROLLBACK');
        } catch (_) {}
        throw error;
      } finally {
        client.release();
      }

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

      await repairPendingQuotationNumbers();
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
        });
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
  },

  async markAsAccepted(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (req.user.role !== 'admin' && req.user.role !== 'manager') {
        return res.status(403).json({ message: 'Only admins and managers can mark quotations as accepted' });
      }

      const { id } = req.params;
      const quoteRequest = await quoteRequestsModel.findById(id);
      if (!quoteRequest) {
        return res.status(404).json({ message: 'Quote request not found' });
      }

      if (quoteRequest.requestType !== 'quotation') {
        return res.status(400).json({ message: 'Only quotations can be marked as accepted' });
      }

      if (quoteRequest.acceptedAt) {
        const existingLead = await leadsModel.findById(quoteRequest.leadId);
        if (!existingLead) {
          return res.status(404).json({ message: 'Lead not found' });
        }
        return res.json(existingLead);
      }

      const existingAccepted = await query(
        `SELECT id FROM quote_requests WHERE lead_id = $1 AND accepted_at IS NOT NULL AND id <> $2 LIMIT 1`,
        [quoteRequest.leadId, id]
      );

      if (existingAccepted.rows.length) {
        return res.status(409).json({ message: 'Another quotation is already accepted for this lead' });
      }

      const subtotalResolution = resolveQuotationSubtotal(quoteRequest.documentData);
      if (subtotalResolution.subtotal === null) {
        console.warn('[Quotation Acceptance] Unable to accept quotation because subtotal could not be resolved.', {
          quoteRequestId: quoteRequest.id,
          leadId: quoteRequest.leadId
        });
        await quoteRequestsModel.update(id, {
          status: 'invalid_for_acceptance',
          invalidAcceptanceReason: 'Accepted quotation subtotal is missing or invalid'
        });

        try {
          await logActivity({
            userId: req.user.id,
            entityType: 'quote_request',
            entityId: id,
            action: 'reject_acceptance_missing_subtotal',
            changes: { status: 'invalid_for_acceptance', reason: 'Accepted quotation subtotal is missing or invalid' }
          });
        } catch (_) {}

        return res.status(422).json({ message: 'Accepted quotation subtotal is missing or invalid', status: 'invalid_for_acceptance' });
      }

      const client = await getClient();
      let updatedLead;
      try {
        await client.query('BEGIN');
        await quoteRequestsModel.update(id, {
          acceptedAt: new Date().toISOString(),
          invalidAcceptanceReason: null,
          status: 'approved'
        }, client);
        updatedLead = await setLeadActualPrice(quoteRequest.leadId, subtotalResolution.subtotal, client);
        await client.query('COMMIT');
      } catch (error) {
        try {
          await client.query('ROLLBACK');
        } catch (_) {}
        throw error;
      } finally {
        client.release();
      }

      if (!updatedLead) {
        return res.status(404).json({ message: 'Lead not found' });
      }

      try {
        await logActivity({
          userId: req.user.id,
          entityType: 'quote_request',
          entityId: id,
          action: 'accept_quotation',
          changes: {
            acceptedAt: new Date().toISOString(),
            subtotal: subtotalResolution.subtotal,
            subtotalSource: subtotalResolution.source
          }
        });
      } catch (_) {}

      try {
        await logActivity({
          userId: req.user.id,
          entityType: 'lead',
          entityId: quoteRequest.leadId,
          action: 'set_actual_price',
          changes: {
            subtotal: subtotalResolution.subtotal,
            actualPrice: (updatedLead as any).actual_price ?? (updatedLead as any).actualPrice ?? null,
            latestRevisedPrice: (updatedLead as any).latest_revised_price ?? (updatedLead as any).latestRevisedPrice ?? null
          }
        });
      } catch (_) {}

      res.json(updatedLead);
    } catch (error) {
      next(error);
    }
  },

  async fixAcceptanceSubtotal(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (req.user.role !== 'admin' && req.user.role !== 'manager') {
        return res.status(403).json({ message: 'Only admins and managers can fix quotation subtotals' });
      }

      const { id } = req.params;
      const { subtotal, note, confirmed } = req.body || {};
      if (confirmed !== true) {
        return res.status(400).json({ message: 'Admin confirmation is required before repairing subtotal' });
      }
      const parsedSubtotal = Number(String(subtotal ?? '').replace(/[^0-9.\-]/g, ''));

      if (!Number.isFinite(parsedSubtotal) || parsedSubtotal <= 0) {
        return res.status(400).json({ message: 'A valid subtotal is required' });
      }

      const existing = await quoteRequestsModel.findById(id);
      if (!existing) {
        return res.status(404).json({ message: 'Quote request not found' });
      }

      if (existing.acceptedAt) {
        return res.status(409).json({ message: 'Accepted quotation subtotal is immutable' });
      }

      const updatedDocumentData = {
        ...(existing.documentData || {}),
        subtotal: String(parsedSubtotal)
      };

      const updated = await quoteRequestsModel.update(id, {
        documentData: updatedDocumentData,
        status: 'admin_pending',
        invalidAcceptanceReason: null
      });

      try {
        await logActivity({
          userId: req.user.id,
          entityType: 'quote_request',
          entityId: id,
          action: 'fix_acceptance_subtotal',
          changes: { subtotal: parsedSubtotal, note: note || null }
        });
      } catch (_) {}

      res.json(updated);
    } catch (error) {
      next(error);
    }
  }
};
