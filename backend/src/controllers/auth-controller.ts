import { Response, NextFunction, Request } from 'express';
import { generateToken, hashPassword, comparePassword } from '../utils/auth';
import { AuthenticatedRequest } from '../middleware/auth';
import { query } from '../utils/database';
import { ensureOfficeAccess } from '../utils/officeAccess';
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
        const officeAccess = ensureOfficeAccess(req);
        console.log('🔍 Agent login attempt:', {
          email: user.email,
          clientIp: officeAccess.clientIp,
          allowed: officeAccess.allowed,
          allowedIps: officeAccess.allowedIps
        });
        if (!officeAccess.allowed) {
          return res.status(403).json({
            message: `Agent login is restricted to office systems only. Your IP: ${officeAccess.clientIp}. Allowed IPs: ${officeAccess.allowedIps.join(', ')}`,
            clientIp: officeAccess.clientIp,
            allowedIps: officeAccess.allowedIps
          });
        }
      }

      await query('UPDATE users SET updated_at = NOW() WHERE id = $1', [user.id]);

      console.log('[AUTH] Login succeeded', { email: user.email, role: user.role, ip: req.ip });

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
      const { email, name, password, role = 'agent' } = validatePayload(authRegisterSchema, req.body);
      const normalizedEmail = String(email).trim().toLowerCase();
      const normalizedName = String(name).trim();

      const hashedPassword = await hashPassword(password);

      const result = await query(
        'INSERT INTO users (email, name, password, role) VALUES ($1, $2, $3, $4) RETURNING id, email, name, role',
        [normalizedEmail, normalizedName, hashedPassword, role]
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
