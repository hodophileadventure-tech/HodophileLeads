import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { notificationsModel } from '../models/Notification';

export const notificationsController = {
  async list(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const rows = await notificationsModel.listByUser(req.user.id);
      res.json(rows);
    } catch (err) {
      next(err);
    }
  },

  async markRead(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const item = await notificationsModel.markRead(req.params.id);
      res.json(item);
    } catch (err) {
      next(err);
    }
  }
};
