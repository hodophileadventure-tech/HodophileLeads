import { Router } from 'express';
import { authMiddleware, roleMiddleware } from '../middleware/auth';
import { dashboardController } from '../controllers/dashboard-controller';

export const dashboardRouter = Router();

dashboardRouter.use(authMiddleware);

dashboardRouter.get('/stats', dashboardController.getStats);
dashboardRouter.get('/pipeline', dashboardController.getPipeline);
dashboardRouter.get('/analytics', roleMiddleware(['admin']), dashboardController.getAnalytics);
dashboardRouter.get('/agent-quick-summary', roleMiddleware(['admin']), dashboardController.getAgentQuickSummary);
dashboardRouter.get('/health', dashboardController.getHealthScore);
