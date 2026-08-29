import { Request, Response, NextFunction } from 'express';
import { getClient, query } from '../utils/database';

interface AttendanceRequest extends Request {
  user?: { id: string; role?: string };
}

interface MonthlyAttendanceRow {
  user_id: string;
  name: string;
  email: string;
  role_name?: string;
  marked_days: number;
  present: number;
  late: number;
  absent: number;
  half_day: number;
  days: Record<string, string>;
}

const STATUSES = new Set(['present', 'late', 'absent', 'half_day']);

export async function getAttendance(req: AttendanceRequest, res: Response, next: NextFunction) {
  try {
    const date = String(req.query.date || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'date must use YYYY-MM-DD format' });
    }

    const isAdminOrQa = ['admin', 'qa', 'quality_assurance'].includes(String(req.user?.role || '').toLowerCase().replace(/\s+/g, '_'));
    const userIdFilter = isAdminOrQa ? null : req.user?.id;

    const result = await query(
      `SELECT u.id AS user_id, u.name, u.email, r.name AS role_name,
              a.status, a.note
       FROM users u
       LEFT JOIN roles r ON r.id = u.role_id
       LEFT JOIN attendance a ON a.user_id = u.id AND a.attendance_date = $1::date
      WHERE COALESCE(r.slug, u.role, '') <> 'admin'
        AND u.attendance_exempt = FALSE
        ${userIdFilter ? 'AND u.id = $2' : ''}
       ORDER BY u.name ASC`,
      userIdFilter ? [date, userIdFilter] : [date]
    );

    const lock = await query('SELECT locked_at FROM attendance_sheets WHERE attendance_date = $1::date', [date]);
    res.json({ success: true, date, locked: lock.rows.length > 0, employees: result.rows });
  } catch (error) {
    next(error);
  }
}

export async function getMonthlyAttendance(req: AttendanceRequest, res: Response, next: NextFunction) {
  try {
    const month = String(req.query.month || '').trim();
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ error: 'month must use YYYY-MM format' });
    }

    const isAdminOrQa = ['admin', 'qa', 'quality_assurance'].includes(String(req.user?.role || '').toLowerCase().replace(/\s+/g, '_'));
    const monthStart = `${month}-01`;

    const result = await query(
      `SELECT u.id AS user_id, u.name, u.email, r.name AS role_name,
              COUNT(a.id)::int AS marked_days,
              COUNT(a.id) FILTER (WHERE a.status = 'present')::int AS present,
              COUNT(a.id) FILTER (WHERE a.status = 'late')::int AS late,
              COUNT(a.id) FILTER (WHERE a.status = 'absent')::int AS absent,
              COUNT(a.id) FILTER (WHERE a.status = 'half_day')::int AS half_day,
              COALESCE(
                json_object_agg(EXTRACT(DAY FROM a.attendance_date)::int, a.status)
                  FILTER (WHERE a.id IS NOT NULL),
                '{}'::json
              ) AS days
       FROM users u
       LEFT JOIN roles r ON r.id = u.role_id
       LEFT JOIN attendance a ON a.user_id = u.id
         AND a.attendance_date >= $1::date
         AND a.attendance_date < ($1::date + INTERVAL '1 month')
      WHERE COALESCE(r.slug, u.role, '') <> 'admin'
        AND u.attendance_exempt = FALSE
        ${isAdminOrQa ? '' : 'AND u.id = $2'}
       GROUP BY u.id, u.name, u.email, r.name
       ORDER BY u.name ASC`,
      isAdminOrQa ? [monthStart] : [monthStart, req.user?.id]
    );

    res.json({ success: true, month, employees: result.rows as MonthlyAttendanceRow[] });
  } catch (error) {
    next(error);
  }
}

export async function saveAttendance(req: AttendanceRequest, res: Response, next: NextFunction) {
  let client: Awaited<ReturnType<typeof getClient>> | null = null;
  try {
    const { date, records, lock } = req.body || {};
    const shouldLock = lock === true || lock === 'true';

    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || '')) || !Array.isArray(records)) {
      return res.status(400).json({ error: 'date and records are required' });
    }

    if (!shouldLock) {
      return res.status(400).json({ error: 'Attendance must be explicitly saved and locked by an admin or QA.' });
    }

    for (const record of records) {
      if (!record?.userId || !STATUSES.has(record.status)) {
        return res.status(400).json({ error: 'Each record needs a userId and valid status' });
      }
    }

    client = await getClient();
    await client.query('BEGIN');
    const lockResult = await client.query(
      `INSERT INTO attendance_sheets (attendance_date, locked_by)
       VALUES ($1::date, $2)
       ON CONFLICT (attendance_date) DO NOTHING
       RETURNING attendance_date`,
      [date, req.user?.id]
    );
    if (lockResult.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'This attendance sheet has already been saved and locked.' });
    }

    const eligibleUsers = await client.query(
      `SELECT u.id FROM users u
       LEFT JOIN roles r ON r.id = u.role_id
       WHERE COALESCE(r.slug, u.role, '') <> 'admin' AND u.attendance_exempt = FALSE`
    );
    const submittedRecords = new Map(records.map((record: any) => [String(record.userId), record]));

    for (const employee of eligibleUsers.rows) {
      const record = submittedRecords.get(String(employee.id));
      const status = record?.status || 'absent';
      await client.query(
        `INSERT INTO attendance (user_id, attendance_date, status, note, marked_by)
         VALUES ($1, $2::date, $3, $4, $5)
         ON CONFLICT (user_id, attendance_date)
         DO UPDATE SET status = EXCLUDED.status,
                       note = EXCLUDED.note,
                       marked_by = EXCLUDED.marked_by,
                       updated_at = NOW()`,
        [employee.id, date, status, record?.note ? String(record.note).trim() : null, req.user?.id]
      );
    }

    await client.query('COMMIT');

    res.json({ success: true, message: 'Attendance saved successfully' });
  } catch (error) {
    if (client) {
      try { await client.query('ROLLBACK'); } catch (_) {}
    }
    next(error);
  } finally {
    client?.release();
  }
}

export const attendanceController = { getAttendance, getMonthlyAttendance, saveAttendance };