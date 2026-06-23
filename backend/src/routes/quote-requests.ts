import { Router } from 'express';
import { authMiddleware, roleMiddleware } from '../middleware/auth';
import { quoteRequestsController } from '../controllers/quote-requests-controller';

export const quoteRequestsRouter = Router();

quoteRequestsRouter.use(authMiddleware);
quoteRequestsRouter.get('/', quoteRequestsController.listByUser);
quoteRequestsRouter.get('/next-number', roleMiddleware(['admin', 'manager']), quoteRequestsController.getNextQuotationNumber);
quoteRequestsRouter.get('/pending', roleMiddleware(['manager', 'admin']), quoteRequestsController.listPending);
quoteRequestsRouter.get('/pending-for-manager', roleMiddleware(['manager']), quoteRequestsController.getPendingForManager);
quoteRequestsRouter.get('/pending-for-admin', roleMiddleware(['admin']), quoteRequestsController.getPendingForAdmin);
quoteRequestsRouter.get('/:id', quoteRequestsController.getById);
quoteRequestsRouter.post('/:id/save', roleMiddleware(['manager']), quoteRequestsController.saveRequest);
quoteRequestsRouter.post('/:id/create-quotation', roleMiddleware(['manager']), quoteRequestsController.createQuotationByManager);
quoteRequestsRouter.post('/:id/approve', roleMiddleware(['admin']), quoteRequestsController.approveRequest);
quoteRequestsRouter.post('/:id/approve-quotation', roleMiddleware(['admin']), quoteRequestsController.approveQuotation);
quoteRequestsRouter.post('/:id/reject-quotation', roleMiddleware(['admin']), quoteRequestsController.rejectQuotation);
quoteRequestsRouter.delete('/:id', quoteRequestsController.deleteRequest);
quoteRequestsRouter.post('/:id/re-request', roleMiddleware(['agent']), quoteRequestsController.reRequestQuote);
