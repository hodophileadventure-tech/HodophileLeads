import { Router } from 'express';
import { authMiddleware, roleMiddleware } from '../middleware/auth';
import { reportController } from '../controllers/report-controller';

export const reportsRouter = Router();

reportsRouter.use(authMiddleware);
reportsRouter.get('/', reportController.listReports);
reportsRouter.get('/me', reportController.getReport);
reportsRouter.post('/compile', reportController.compileAndGetReport);
reportsRouter.post('/admin/compile-all', roleMiddleware(['admin', 'qa']), reportController.compileAllReports);
reportsRouter.get('/admin', roleMiddleware(['admin', 'qa']), reportController.getAdminReport);
reportsRouter.get('/export', roleMiddleware(['admin', 'qa']), reportController.exportAdminReport);
