import { Router } from 'express';
import { authController } from '../controllers/auth-controller';
import { authMiddleware } from '../middleware/auth';

export const authRouter = Router();

authRouter.post('/login', authController.login);
authRouter.post('/register', authController.register);
authRouter.post('/logout', authMiddleware, authController.logout);
authRouter.post('/refresh', authMiddleware, authController.refresh);
authRouter.post('/change-password', authMiddleware, authController.changePassword);
