import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { paymentsController } from '../controllers/payments-controller';

export const paymentsRouter = Router();

paymentsRouter.use(authMiddleware);
paymentsRouter.get('/', paymentsController.list);
paymentsRouter.post('/', paymentsController.create);
paymentsRouter.put('/:id', paymentsController.update);
paymentsRouter.patch('/:id/confirm', paymentsController.confirm);
paymentsRouter.delete('/:id', paymentsController.delete);
