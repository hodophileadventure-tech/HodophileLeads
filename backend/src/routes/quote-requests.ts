import { Router } from 'express';
import { authMiddleware, roleMiddleware } from '../middleware/auth';
import { quoteRequestsController } from '../controllers/quote-requests-controller';

export const quoteRequestsRouter = Router();

quoteRequestsRouter.use(authMiddleware);
quoteRequestsRouter.get('/', quoteRequestsController.listByUser);
quoteRequestsRouter.get('/next-number', roleMiddleware(['admin']), quoteRequestsController.getNextQuotationNumber);
quoteRequestsRouter.get('/pending', roleMiddleware(['admin']), quoteRequestsController.listPending);
quoteRequestsRouter.get('/:id', quoteRequestsController.getById);
quoteRequestsRouter.post('/:id/save', roleMiddleware(['admin']), quoteRequestsController.saveRequest);
quoteRequestsRouter.delete('/:id', quoteRequestsController.deleteRequest);
quoteRequestsRouter.post('/:id/re-request', roleMiddleware(['agent']), quoteRequestsController.reRequestQuote);
