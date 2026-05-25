import { Router } from 'express';
import { authMiddleware, roleMiddleware } from '../middleware/auth';
import { adminController } from '../controllers/admin-controller';

export const adminRouter = Router();

adminRouter.use(authMiddleware);
adminRouter.get('/red-flags', roleMiddleware(['admin']), adminController.redFlags);
 
// Agents management
adminRouter.get('/agents', roleMiddleware(['admin']), adminController.listAgents);
adminRouter.get('/agents/:id/leads', roleMiddleware(['admin']), adminController.getAgentLeads);
adminRouter.put('/agents/:id', roleMiddleware(['admin']), adminController.updateAgent);
adminRouter.post('/agents/:id/reset-password', roleMiddleware(['admin']), adminController.resetAgentPassword);
// follow-up stats per agent
adminRouter.get('/agents/follow-up-stats', roleMiddleware(['admin']), adminController.followUpStats);
// revenue stats per agent
adminRouter.get('/agents/revenue-stats', roleMiddleware(['admin']), adminController.revenueStats);
