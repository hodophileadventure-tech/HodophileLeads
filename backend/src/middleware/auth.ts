import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/auth';
import { query } from '../utils/database';

export interface AuthenticatedRequest extends Request {
  user?: any;
  query: Record<string, any>;
  params: Record<string, any>;
  body: any;
}

export const authMiddleware = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Missing or invalid authorization header' });
  }

  const token = authHeader.substring(7);
  const decoded = verifyToken(token);

  if (!decoded) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }

  // IP restrictions removed - all users allowed to login
  req.user = decoded;
  next();
};

export const validateUserExists = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    const result = await query('SELECT id FROM users WHERE id = $1', [req.user.id]);
    if (!result.rows.length) {
      return res.status(401).json({ message: 'User has been deleted. Please log in again.' });
    }

    next();
  } catch (err) {
    next(err);
  }
};

export const roleMiddleware = (allowedRoles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }
    next();
  };
};

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Error:', err);

  if (err.name === 'ValidationError') {
    return res.status(400).json({ message: err.message });
  }

  res.status(err.status || 500).json({
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};
