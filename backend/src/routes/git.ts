import { Router } from 'express';
import { authMiddleware, roleMiddleware } from '../middleware/auth';
import { gitController } from '../controllers/git-controller';

export const gitRouter = Router();

gitRouter.use(authMiddleware);

// Only admin can access git history and revert commits
gitRouter.get('/commits', roleMiddleware(['admin']), gitController.getCommitHistory);
gitRouter.get('/commits/:hash', roleMiddleware(['admin']), gitController.getCommitDetails);
gitRouter.post('/revert', roleMiddleware(['admin']), gitController.revertToCommit);
gitRouter.get('/current', roleMiddleware(['admin']), gitController.getCurrentCommit);
