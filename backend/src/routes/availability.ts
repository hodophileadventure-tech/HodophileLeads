import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { availabilityController } from '../controllers/availability-controller';

export const availabilityRouter = Router();

availabilityRouter.use(authMiddleware);
availabilityRouter.get('/:leadId', availabilityController.getByLead);
availabilityRouter.put('/:leadId', availabilityController.upsert);
availabilityRouter.get('/:leadId/gates', availabilityController.gateStatus);
