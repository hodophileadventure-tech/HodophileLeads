import { Router } from 'express';
import { authMiddleware, roleMiddleware } from '../middleware/auth';
import { gitController } from '../controllers/git-controller';

export const gitRouter = Router();

gitRouter.use(authMiddleware);

// Only admin can access git history and revert commits
gitRouter.get('/commits', roleMiddleware(['admin', 'qa']), gitController.getCommitHistory);
gitRouter.get('/commits/:hash', roleMiddleware(['admin', 'qa']), gitController.getCommitDetails);
gitRouter.post('/revert', roleMiddleware(['admin', 'qa']), gitController.revertToCommit);
gitRouter.get('/current', roleMiddleware(['admin', 'qa']), gitController.getCurrentCommit);
