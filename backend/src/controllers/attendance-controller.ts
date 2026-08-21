import { Request, Response, NextFunction } from 'express';
import { query } from '../utils/database';

interface AttendanceRequest extends Request {
  user?: { id: string };
}

const STATUSES = new Set(['present', 'late', 'absent', 'half_day']);

export async function getAttendance(req: AttendanceRequest, res: Response, next: NextFunction) {
  try {
    const date = String(req.query.date || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'date must use YYYY-MM-DD format' });
    }

    const result = await query(
      `SELECT u.id AS user_id, u.name, u.email, r.name AS role_name,
              a.status, a.note
       FROM users u
       LEFT JOIN roles r ON r.id = u.role_id
       LEFT JOIN attendance a ON a.user_id = u.id AND a.attendance_date = $1::date
       WHERE COALESCE(r.slug, u.role, '') <> 'admin'
       ORDER BY u.name ASC`,
      [date]
    );

    res.json({ success: true, date, employees: result.rows });
  } catch (error) {
    next(error);
  }
}

export async function saveAttendance(req: AttendanceRequest, res: Response, next: NextFunction) {
  try {
    const { date, records } = req.body || {};
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || '')) || !Array.isArray(records)) {
      return res.status(400).json({ error: 'date and records are required' });
    }

    for (const record of records) {
      if (!record?.userId || !STATUSES.has(record.status)) {
        return res.status(400).json({ error: 'Each record needs a userId and valid status' });
      }
      await query(
        `INSERT INTO attendance (user_id, attendance_date, status, note, marked_by)
         VALUES ($1, $2::date, $3, $4, $5)
         ON CONFLICT (user_id, attendance_date)
         DO UPDATE SET status = EXCLUDED.status,
                       note = EXCLUDED.note,
                       marked_by = EXCLUDED.marked_by,
                       updated_at = NOW()`,
        [record.userId, date, record.status, record.note ? String(record.note).trim() : null, req.user?.id]
      );
    }

    res.json({ success: true, message: 'Attendance saved successfully' });
  } catch (error) {
    next(error);
  }
}

export const attendanceController = { getAttendance, saveAttendance };