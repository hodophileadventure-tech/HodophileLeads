import { Response, NextFunction, Request } from 'express';
import { generateToken, hashPassword, comparePassword } from '../utils/auth';
import { AuthenticatedRequest } from '../middleware/auth';
import { query } from '../utils/database';
import { authLoginSchema, authRegisterSchema, validatePayload } from '../utils/validation';

export const authController = {
  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password } = validatePayload(authLoginSchema, req.body);
      const normalizedEmail = String(email).trim().toLowerCase();

      console.log('[AUTH] Login attempt', { email: normalizedEmail, ip: req.ip });

      const result = await query('SELECT * FROM users WHERE email = $1', [normalizedEmail]);
      const user = result.rows[0];

      if (!user) {
        console.warn('[AUTH] Login failed: user not found', { email: normalizedEmail, ip: req.ip });
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      const validPassword = await comparePassword(password, user.password);
      if (!validPassword) {
        console.warn('[AUTH] Login failed: invalid password', { email: normalizedEmail, ip: req.ip });
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      if (user.role === 'agent') {
        // IP restrictions removed - all agents can login from anywhere
      }

      await query('UPDATE users SET updated_at = NOW() WHERE id = $1', [user.id]);

      console.log('[AUTH] Login succeeded', { email: user.email, role: user.role, ip: req.ip });

      // Issue shorter-lived tokens for elevated/internal roles
      const privilegedRoles = ['admin', 'agent', 'manager'];
      const tokenExpiry = privilegedRoles.includes(user.role) ? '9h' : undefined;

      const token = generateToken({
        id: user.id,
        email: user.email,
        role: user.role
      }, tokenExpiry);

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
      const { email, name, password, role = 'agent' } = validatePayload(authRegisterSchema, req.body);
      const normalizedEmail = String(email).trim().toLowerCase();
      const normalizedName = String(name).trim();

      const hashedPassword = await hashPassword(password);

      const result = await query(
        'INSERT INTO users (email, name, password, role) VALUES ($1, $2, $3, $4) RETURNING id, email, name, role',
        [normalizedEmail, normalizedName, hashedPassword, role]
      );

      const user = result.rows[0];

      const privilegedRoles = ['admin', 'agent', 'manager'];
      const tokenExpiry = privilegedRoles.includes(user.role) ? '9h' : undefined;

      const token = generateToken({
        id: user.id,
        email: user.email,
        role: user.role
      }, tokenExpiry);

      res.status(201).json({
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role
        }
      });
    } catch (error: any) {
      console.error('[AUTH REGISTER ERROR]', { message: error?.message, code: error?.code });
      // Handle duplicate email constraint violation
      if (error?.code === '23505' || error?.message?.includes('duplicate') || error?.message?.includes('unique')) {
        return res.status(400).json({ message: 'Email already registered' });
      }
      next(error);
    }
  },

  async logout(req: Request, res: Response, next: NextFunction) {
    try {
      const authReq = req as AuthenticatedRequest;
      if (authReq.user?.id) {
        await query('UPDATE users SET last_logout_at = NOW(), updated_at = NOW() WHERE id = $1', [authReq.user.id]);
      }
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

      const privilegedRoles = ['admin', 'agent', 'manager'];
      const tokenExpiry = privilegedRoles.includes(user.role) ? '9h' : undefined;

      const token = generateToken({ id: user.id, email: user.email, role: user.role }, tokenExpiry);
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

  async changePassword(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { currentPassword, newPassword } = req.body;
      const authReq = req as AuthenticatedRequest;

      if (!authReq.user?.id) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: 'Current password and new password are required' });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ message: 'New password must be at least 6 characters' });
      }

      if (currentPassword === newPassword) {
        return res.status(400).json({ message: 'New password must be different from current password' });
      }

      // Get current user password
      const userResult = await query('SELECT password FROM users WHERE id = $1', [authReq.user.id]);
      if (userResult.rows.length === 0) {
        return res.status(404).json({ message: 'User not found' });
      }

      const user = userResult.rows[0];
      const validPassword = await comparePassword(currentPassword, user.password);
      if (!validPassword) {
        console.warn('[AUTH] Password change failed: incorrect current password', { userId: authReq.user.id });
        return res.status(401).json({ message: 'Current password is incorrect' });
      }

      // Hash new password and update
      const hashedPassword = await hashPassword(newPassword);
      await query('UPDATE users SET password = $1, updated_at = NOW() WHERE id = $2', [hashedPassword, authReq.user.id]);

      console.log('[AUTH] Password changed successfully', { userId: authReq.user.id, email: authReq.user.email });

      res.json({ message: 'Password changed successfully' });
    } catch (error) {
      next(error);
    }
  }
};
