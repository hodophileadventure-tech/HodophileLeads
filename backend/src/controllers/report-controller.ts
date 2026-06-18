import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { dailyReportsModel } from '../models/DailyReport';
import { query } from '../utils/database';
import { compileReportForUser, compileAllReports } from '../workers/reportWorker';

const getPeriodDates = (reportType: 'daily' | 'weekly' | 'monthly', date: string) => {
  const target = new Date(date);
  const getStartOfWeek = (d: Date) => {
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d);
    monday.setDate(diff);
    monday.setHours(0, 0, 0, 0);
    return monday;
  };
  const getEndOfWeek = (d: Date) => {
    const monday = getStartOfWeek(d);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    return sunday;
  };
  const getStartOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
  const getEndOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);

  if (reportType === 'daily') {
    return {
      start: new Date(target.setHours(0, 0, 0, 0)).toISOString().slice(0, 10),
      end: new Date(target.setHours(23, 59, 59, 999)).toISOString().slice(0, 10)
    };
  }
  if (reportType === 'weekly') {
    return {
      start: getStartOfWeek(target).toISOString().slice(0, 10),
      end: getEndOfWeek(target).toISOString().slice(0, 10)
    };
  }
  return {
    start: getStartOfMonth(target).toISOString().slice(0, 10),
    end: getEndOfMonth(target).toISOString().slice(0, 10)
  };
};

export const reportController = {
  async listReports(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const reportType = (req.query.type as string) || 'daily';
      const date = (req.query.date as string) || new Date().toISOString().slice(0, 10);
      const page = Number(req.query.page || 1);
      const limit = Number(req.query.limit || 30);
      const offset = (page - 1) * limit;
      const reports = await dailyReportsModel.listByUser(req.user.id, reportType as any, limit, offset);
      res.json({ reports, total: reports.length, page, limit });
    } catch (error) {
      next(error);
    }
  },

  async getReport(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const reportType = (req.query.type as string) || 'daily';
      const date = String(req.query.date || new Date().toISOString().slice(0, 10));
      let report = await dailyReportsModel.findByUserAndDate(req.user.id, reportType as any, date);
      if (!report) {
        // attempt to compile on demand if the report is missing
        try {
          const compiled = await compileReportForUser(req.user.id, reportType as any, new Date(date));
          report = compiled;
        } catch (compileError) {
          console.warn('[ReportController] on-demand compile failed', compileError);
        }
      }
      if (!report) {
        return res.status(404).json({ message: 'Report not found' });
      }
      res.json(report);
    } catch (error) {
      next(error);
    }
  },

  async getAdminReport(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const reportType = (req.query.type as string) || 'daily';
      const date = String(req.query.date || new Date().toISOString().slice(0, 10));
      const { start, end } = getPeriodDates(reportType as any, date);
      const results = await dailyReportsModel.listByDateRange(start, end, reportType as any, 200, 0);
      res.json({ reports: results, total: results.length, reportType, period: { start, end } });
    } catch (error) {
      next(error);
    }
  },

  async exportAdminReport(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const reportType = (req.query.type as string) || 'daily';
      const date = String(req.query.date || new Date().toISOString().slice(0, 10));
      const { start, end } = getPeriodDates(reportType as any, date);
      const reports = await dailyReportsModel.listByDateRange(start, end, reportType as any, 1000, 0);
      const rows = reports.map((row: any) => ({
        reportDate: row.report_date,
        reportType: row.report_type,
        userName: row.user_name || row.userName,
        userEmail: row.user_email || row.userEmail,
        periodStart: row.period_start || row.periodStart,
        periodEnd: row.period_end || row.periodEnd,
        totalActivities: row.total_activities || row.totalActivities,
        createdAt: row.created_at || row.createdAt,
        updatedAt: row.updated_at || row.updatedAt,
        totals: row.report_data?.totals || {},
        actions: row.report_data?.actions || []
      }));

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="tripnexus-reports-${reportType}-${date}.json"`);
      res.send(JSON.stringify({ reportType, period: { start, end }, reports: rows }, null, 2));
    } catch (error) {
      next(error);
    }
  },

  async compileAndGetReport(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const reportType = (req.body.type as string) || 'daily';
      const date = String(req.body.date || new Date().toISOString().slice(0, 10));
      const { start, end } = getPeriodDates(reportType as any, date);
      const result = await query(
        `SELECT * FROM daily_reports WHERE report_type = $1 AND report_date = $2 AND user_id = $3 LIMIT 1`,
        [reportType, date, req.user.id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ message: 'Report not compiled yet' });
      }

      res.json(result.rows[0]);
    } catch (error) {
      next(error);
    }
  },

  async compileAllReports(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      console.log('[ReportController] Admin triggered manual report compilation');
      await compileAllReports();
      res.json({ success: true, message: 'Reports compiled successfully for all users' });
    } catch (error) {
      console.error('[ReportController] Failed to compile reports', error);
      next(error);
    }
  }
};
