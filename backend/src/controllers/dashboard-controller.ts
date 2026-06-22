import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { query } from '../utils/database';

export const dashboardController = {
  async getStats(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const [statsResult, paymentsResult, overdueResult] = await Promise.allSettled([
        query(`
          SELECT
            COUNT(*)::int as total_leads,
            COUNT(*) FILTER (WHERE temperature = 'hot')::int as hot_leads,
            COUNT(*) FILTER (WHERE EXTRACT(MONTH FROM created_at) = EXTRACT(MONTH FROM NOW()) AND status = 'booked')::int as bookings_this_month,
            COALESCE(SUM(CASE WHEN status = 'booked' THEN budget ELSE 0 END), 0)::numeric as total_revenue
          FROM leads
          WHERE agent_id = $1
        `, [req.user.id]),
        query(`
          SELECT
            COUNT(*) FILTER (WHERE p.status = 'pending')::int as pending_payments,
            COUNT(*) FILTER (WHERE p.status = 'confirmed')::int as confirmed_payments
          FROM payments p
          JOIN leads l ON l.id = p.lead_id
          WHERE l.agent_id = $1
        `, [req.user.id]),
        query(`
          SELECT COUNT(*)::int as overdue_tasks
          FROM follow_ups f
          JOIN leads l ON l.id = f.lead_id
          WHERE l.agent_id = $1 AND f.status != 'completed' AND f.due_date < NOW()
        `, [req.user.id])
      ]);

      const stats = statsResult.status === 'fulfilled' ? statsResult.value.rows[0] : null;
      const payments = paymentsResult.status === 'fulfilled' ? paymentsResult.value.rows[0] : null;
      const overdueTasks = overdueResult.status === 'fulfilled' ? overdueResult.value.rows[0] : null;

      if (statsResult.status === 'rejected') {
        console.error('[Dashboard] stats query failed', statsResult.reason);
      }
      if (paymentsResult.status === 'rejected') {
        console.error('[Dashboard] payments query failed', paymentsResult.reason);
      }
      if (overdueResult.status === 'rejected') {
        console.error('[Dashboard] overdue query failed', overdueResult.reason);
      }

      res.json({
        totalLeads: parseInt(stats?.total_leads) || 0,
        hotLeads: parseInt(stats?.hot_leads) || 0,
        bookingsThisMonth: parseInt(stats?.bookings_this_month) || 0,
        totalRevenue: parseFloat(stats?.total_revenue) || 0,
        pipelineHealth: parseInt(stats?.hot_leads) > 0 ? 'yellow' : 'green',
        pendingPayments: parseInt(payments?.pending_payments) || 0,
        confirmedPayments: parseInt(payments?.confirmed_payments) || 0,
        overdueTasks: parseInt(overdueTasks?.overdue_tasks) || 0,
        negotiationLeads: 0
      });
    } catch (error) {
      next(error);
    }
  },

  async getPipeline(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await query(`
        SELECT status, COUNT(*) as count, temperature
        FROM leads
        WHERE agent_id = $1
        GROUP BY status, temperature
        ORDER BY status
      `, [req.user.id]);

      res.json(result.rows);
    } catch (error) {
      next(error);
    }
  },

  async getAnalytics(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await query(`
        SELECT
          COUNT(*) FILTER (WHERE temperature = 'hot') as hot_leads,
          COUNT(*) FILTER (WHERE temperature = 'warm') as warm_leads,
          COUNT(*) FILTER (WHERE temperature = 'cold') as cold_leads,
          COUNT(*) FILTER (WHERE temperature = 'dead' OR status IN ('completed', 'canceled')) as dead_leads,
          AVG(budget) as avg_budget,
          COUNT(DISTINCT agent_id) as total_agents
        FROM leads
      `);

      res.json(result.rows[0]);
    } catch (error) {
      next(error);
    }
  },

  async getHealthScore(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await query(`
        SELECT
          COUNT(*) FILTER (WHERE status IN ('booked', 'completed')) as completed_bookings,
          COUNT(*) FILTER (WHERE status IN ('negotiation')) as in_negotiation,
          COUNT(*) FILTER (WHERE status = 'new') as new_leads
        FROM leads
        WHERE agent_id = $1
      `, [req.user.id]);

      const stats = result.rows[0];
      const totalLeads = parseInt(stats.completed_bookings) + parseInt(stats.in_negotiation) + parseInt(stats.new_leads);
      const completionRate = totalLeads > 0 ? (parseInt(stats.completed_bookings) / totalLeads) * 100 : 0;

      let health = 'yellow';
      if (completionRate >= 75) health = 'green';
      if (completionRate < 25) health = 'red';

      res.json({
        score: completionRate.toFixed(1),
        health,
        completedBookings: parseInt(stats.completed_bookings),
        inNegotiation: parseInt(stats.in_negotiation),
        newLeads: parseInt(stats.new_leads)
      });
    } catch (error) {
      next(error);
    }
  }
};
