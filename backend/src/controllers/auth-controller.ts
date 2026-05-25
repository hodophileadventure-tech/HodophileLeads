import { Response, NextFunction, Request } from 'express';
import { generateToken, hashPassword, comparePassword } from '../utils/auth';
import { AuthenticatedRequest } from '../middleware/auth';
import { query } from '../utils/database';
import { ensureOfficeAccess } from '../utils/officeAccess';

export const authController = {
  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password } = req.body;

      const result = await query('SELECT * FROM users WHERE email = $1', [email]);
      const user = result.rows[0];

      if (!user) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      const validPassword = await comparePassword(password, user.password);
      if (!validPassword) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      if (user.role === 'agent') {
        const officeAccess = ensureOfficeAccess(req);
        if (!officeAccess.allowed) {
          return res.status(403).json({
            message: 'Agent login is restricted to office systems only',
            clientIp: officeAccess.clientIp
          });
        }
      }

      const token = generateToken({
        id: user.id,
        email: user.email,
        role: user.role
      });

      res.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role
        }
      });
    } catch (error) {
      next(error);
    }
  },

  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, name, password, role = 'agent' } = req.body;

      const hashedPassword = await hashPassword(password);

      const result = await query(
        'INSERT INTO users (email, name, password, role) VALUES ($1, $2, $3, $4) RETURNING id, email, name, role',
        [email, name, hashedPassword, role]
      );

      const user = result.rows[0];

      const token = generateToken({
        id: user.id,
        email: user.email,
        role: user.role
      });

      res.status(201).json({
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role
        }
      });
    } catch (error) {
      next(error);
    }
  },

  async logout(req: Request, res: Response, next: NextFunction) {
    try {
      // Logout is typically handled client-side by removing token
      res.json({ message: 'Logged out successfully' });
    } catch (error) {
      next(error);
    }
  },

  async refresh(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const user = req.user;
      if (!user?.id) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      const token = generateToken({ id: user.id, email: user.email, role: user.role });
      res.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role
        }
      });
    } catch (error) {
      next(error);
    }
  }
};
