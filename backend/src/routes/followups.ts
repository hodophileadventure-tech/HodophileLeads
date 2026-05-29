import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { followUpsController } from '../controllers/followups-controller';

export const followUpsRouter = Router();

followUpsRouter.use(authMiddleware);
followUpsRouter.get('/', followUpsController.list);
followUpsRouter.post('/', followUpsController.create);
followUpsRouter.put('/:id', followUpsController.update);
followUpsRouter.patch('/:id/complete', followUpsController.complete);
followUpsRouter.patch('/:id/cancel', followUpsController.cancel);
followUpsRouter.delete('/:id', followUpsController.delete);
