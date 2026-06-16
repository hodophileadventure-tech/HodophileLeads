import { query } from '../utils/database';

type ReportType = 'daily' | 'weekly' | 'monthly';

export interface DailyReportRecord {
  id: string;
  reportType: ReportType;
  reportDate: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  periodStart: string;
  periodEnd: string;
  reportData: any;
  totalActivities: number;
  createdAt: string;
  updatedAt: string;
}

export const dailyReportsModel = {
  async upsert(report: {
    reportType: ReportType;
    reportDate: string;
    userId: string;
    periodStart: string;
    periodEnd: string;
    reportData: any;
    totalActivities: number;
  }) {
    const sql = `
      INSERT INTO daily_reports (
        report_type, report_date, user_id, period_start, period_end, report_data, total_activities, created_at, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,NOW(),NOW())
      ON CONFLICT (report_type, report_date, user_id)
      DO UPDATE SET
        report_data = EXCLUDED.report_data,
        total_activities = EXCLUDED.total_activities,
        updated_at = NOW()
      RETURNING *
    `;
    const params = [
      report.reportType,
      report.reportDate,
      report.userId,
      report.periodStart,
      report.periodEnd,
      report.reportData,
      report.totalActivities
    ];
    const result = await query(sql, params);
    return result.rows[0];
  },

  async findByUserAndDate(userId: string, reportType: ReportType, reportDate: string) {
    const sql = `
      SELECT * FROM daily_reports
      WHERE user_id = $1 AND report_type = $2 AND report_date = $3
      LIMIT 1
    `;
    const result = await query(sql, [userId, reportType, reportDate]);
    return result.rows[0];
  },

  async listByUser(userId: string, reportType: ReportType, limit = 50, offset = 0) {
    const sql = `
      SELECT dr.*, u.name AS user_name, u.email AS user_email
      FROM daily_reports dr
      LEFT JOIN users u ON dr.user_id = u.id
      WHERE dr.user_id = $1 AND dr.report_type = $2
      ORDER BY dr.report_date DESC
      LIMIT $3 OFFSET $4
    `;
    const result = await query(sql, [userId, reportType, limit, offset]);
    return result.rows.map((row: any) => ({
      ...row,
      userName: row.user_name,
      userEmail: row.user_email
    }));
  },

  async listByDateRange(startDate: string, endDate: string, reportType: ReportType, limit = 100, offset = 0, userId?: string) {
    let sql = `
      SELECT dr.*, u.name AS user_name, u.email AS user_email
      FROM daily_reports dr
      LEFT JOIN users u ON dr.user_id = u.id
      WHERE dr.report_type = $1 AND dr.report_date BETWEEN $2 AND $3
    `;
    let params: any[];

    if (userId) {
      sql += ' AND dr.user_id = $4';
      sql += `\n      ORDER BY dr.report_date DESC\n      LIMIT $5 OFFSET $6`;
      params = [reportType, startDate, endDate, userId, limit, offset];
    } else {
      sql += `\n      ORDER BY dr.report_date DESC\n      LIMIT $4 OFFSET $5`;
      params = [reportType, startDate, endDate, limit, offset];
    }

    const result = await query(sql, params);
    return result.rows.map((row: any) => ({
      ...row,
      userName: row.user_name,
      userEmail: row.user_email
    }));
  }
};
