import { Router } from 'express';
import { notificationsController } from '../controllers/notifications-controller';
import { authMiddleware } from '../middleware/auth';

export const notificationsRouter = Router();

notificationsRouter.use(authMiddleware);

notificationsRouter.get('/', notificationsController.list);
notificationsRouter.patch('/:id/read', notificationsController.markRead);
