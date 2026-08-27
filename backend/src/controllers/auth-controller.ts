import { Response, NextFunction, Request } from 'express';
import { generateToken, hashPassword, comparePassword } from '../utils/auth';
import { AuthenticatedRequest } from '../middleware/auth';
import { query } from '../utils/database';
import { authLoginSchema, authRegisterSchema, validatePayload } from '../utils/validation';
import crypto from 'crypto';

const ATTENDANCE_TIMEZONE = process.env.ATTENDANCE_TIMEZONE || 'Asia/Karachi';
const ATTENDANCE_GRACE_MINUTES = Number(process.env.ATTENDANCE_GRACE_MINUTES || 15);

async function markLoginAttendance(userId: string, role: string) {
  if (role === 'admin') return;

  await query(
    `WITH local_clock AS (
      SELECT (CURRENT_TIMESTAMP AT TIME ZONE $2)::date AS attendance_date,
        (CURRENT_TIMESTAMP AT TIME ZONE $2)::time AS current_time,
        to_char(CURRENT_TIMESTAMP AT TIME ZONE $2, 'YYYY-MM-DD HH24:MI:SS') AS login_time
     )
    INSERT INTO attendance (user_id, attendance_date, status, marked_by, note)
         SELECT u.id, local_clock.attendance_date,
            CASE WHEN local_clock.current_time > (u.reporting_time + ($3::int * INTERVAL '1 minute'))::time
              THEN 'late' ELSE 'present' END,
           u.id,
           'Login time: ' || local_clock.login_time
     FROM users u CROSS JOIN local_clock
     WHERE u.id = $1
       AND (u.working_days = 'monday-saturday' OR EXTRACT(ISODOW FROM local_clock.attendance_date) BETWEEN 1 AND 5)
      AND u.attendance_exempt = FALSE
       AND NOT EXISTS (
         SELECT 1 FROM attendance_sheets s WHERE s.attendance_date = local_clock.attendance_date
       )
     ON CONFLICT (user_id, attendance_date) DO UPDATE
       SET status = EXCLUDED.status, note = EXCLUDED.note, updated_at = NOW()
       WHERE attendance.marked_by = EXCLUDED.marked_by
         AND NOT EXISTS (
           SELECT 1 FROM attendance_sheets s WHERE s.attendance_date = EXCLUDED.attendance_date
         )`,
    [userId, ATTENDANCE_TIMEZONE, ATTENDANCE_GRACE_MINUTES]
  );
}

export const authController = {
  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password } = validatePayload(authLoginSchema, req.body);
      const normalizedEmail = String(email).trim().toLowerCase();

      console.log('[AUTH] Login attempt', { email: normalizedEmail, ip: req.ip });

      // Try to fetch user with role details from roles table
      // Fall back to simple query if roles table doesn't exist (backwards compatibility)
      let user: any = null;
      try {
        const result = await query(
          `SELECT u.*, r.slug as role_slug, r.name as role_name
           FROM users u
           LEFT JOIN roles r ON u.role_id = r.id
           WHERE u.email = $1`,
          [normalizedEmail]
        );
        user = result.rows[0];
      } catch (roleError: any) {
        // If roles table doesn't exist, fall back to simple query
        if (roleError?.code === '42P01') {
          console.log('[AUTH] Roles table not found, using fallback query', { email: normalizedEmail });
          const result = await query('SELECT * FROM users WHERE email = $1', [normalizedEmail]);
          user = result.rows[0];
        } else {
          throw roleError;
        }
      }

      if (!user) {
        console.warn('[AUTH] Login failed: user not found', { email: normalizedEmail, ip: req.ip });
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      let validPassword = await comparePassword(password, user.password);

      // Users created before the bcrypt fix have a legacy SHA-256 hash.
      // Accept it once, then upgrade the stored hash immediately.
      if (!validPassword && /^[a-f0-9]{64}$/i.test(String(user.password || ''))) {
        const legacyHash = crypto.createHash('sha256').update(password).digest('hex');
        if (legacyHash === String(user.password).toLowerCase()) {
          validPassword = true;
          const upgradedHash = await hashPassword(password);
          await query('UPDATE users SET password = $1, updated_at = NOW() WHERE id = $2', [upgradedHash, user.id]);
          console.log('[AUTH] Upgraded legacy password hash to bcrypt', { userId: user.id });
        }
      }

      if (!validPassword) {
        console.warn('[AUTH] Login failed: invalid password', { email: normalizedEmail, ip: req.ip });
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      const authenticatedRole = user.role_slug || user.role;

      await query('UPDATE users SET updated_at = NOW() WHERE id = $1', [user.id]);

      console.log('[AUTH] Login succeeded', { email: user.email, role: authenticatedRole, roleSlug: user.role_slug, ip: req.ip });

      // Issue shorter-lived tokens for elevated/internal roles
      const privilegedRoles = ['admin', 'qa', 'agent', 'manager'];
      const tokenExpiry = privilegedRoles.includes(authenticatedRole) ? '9h' : undefined;

      const token = generateToken({
        id: user.id,
        email: user.email,
        role: authenticatedRole
      }, tokenExpiry);

      try {
        await markLoginAttendance(user.id, authenticatedRole);
      } catch (attendanceError) {
        console.error('[AUTH] Could not mark login attendance', { userId: user.id, attendanceError });
      }

      res.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: authenticatedRole,
          role_slug: authenticatedRole,
          role_name: user.role_name || authenticatedRole,
          date_of_birth: user.date_of_birth || null
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

      // Try to use role_id if roles table exists, otherwise use role string
      let result: any;
      try {
        // Check if roles table exists and try to use it
        const roleResult = await query('SELECT id FROM roles WHERE slug = $1', [role]);
        const roleId = roleResult.rows[0]?.id;

        if (roleId) {
          result = await query(
            'INSERT INTO users (email, name, password, role_id) VALUES ($1, $2, $3, $4) RETURNING id, email, name',
            [normalizedEmail, normalizedName, hashedPassword, roleId]
          );
        } else {
          throw new Error(`Role not found: ${role}`);
        }
      } catch (roleError: any) {
        // If roles table doesn't exist, fall back to role string (legacy mode)
        if (roleError?.code === '42P01' || roleError?.message?.includes('not found')) {
          console.log('[AUTH REGISTER] Roles table not found, using legacy role column', { role });
          result = await query(
            'INSERT INTO users (email, name, password, role) VALUES ($1, $2, $3, $4) RETURNING id, email, name, role',
            [normalizedEmail, normalizedName, hashedPassword, role]
          );
        } else {
          throw roleError;
        }
      }

      const user = result.rows[0];

      // Try to fetch role details if available
      let roleDetails: any = { slug: role, name: role };
      try {
        const roleDetailsResult = await query(
          'SELECT slug, name FROM roles WHERE slug = $1',
          [role]
        );
        if (roleDetailsResult.rows[0]) {
          roleDetails = roleDetailsResult.rows[0];
        }
      } catch (e) {
        // Roles table might not exist, that's ok
        console.log('[AUTH REGISTER] Could not fetch role details', { role });
      }

      const privilegedRoles = ['admin', 'qa', 'agent', 'manager'];
      const tokenExpiry = privilegedRoles.includes(role) ? '9h' : undefined;

      const token = generateToken({
        id: user.id,
        email: user.email,
        role: role
      }, tokenExpiry);

      res.status(201).json({
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: role,
          role_slug: roleDetails?.slug || role,
          role_name: roleDetails?.name || role
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
