import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { itinerariesController } from '../controllers/itineraries-controller';

export const itinerariesRouter = Router();

itinerariesRouter.use(authMiddleware);

itinerariesRouter.post('/:id/generate-pdf', itinerariesController.generatePdf);

export default itinerariesRouter;
