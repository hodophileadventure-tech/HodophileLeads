import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { query } from '../utils/database';

export const MONTHLY_AGENT_TARGET = 5_000_000;

export const calculateMonthlyTargetProgress = (achievedAmount: number | string, target = MONTHLY_AGENT_TARGET) => {
  const numericAchieved = Number(achievedAmount) || 0;
  const numericTarget = Number(target) || 0;
  const progress = numericTarget > 0 ? Math.min(100, Math.round((numericAchieved / numericTarget) * 100)) : 0;

  return {
    monthlyTarget: numericTarget,
    monthlyTargetAchieved: numericAchieved,
    monthlyTargetProgress: progress,
    monthlyTargetRemaining: Math.max(0, numericTarget - numericAchieved)
  };
};

export const canAccessAdminLikeAnalytics = (role?: string) => role === 'admin' || role === 'manager';

export const getLeadScopeAgentId = (role?: string, userId?: string) => {
  return role === 'agent' ? userId : undefined;
};

export const dashboardController = {
  async getStats(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const scopeAgentId = getLeadScopeAgentId(req.user?.role, req.user?.id);
      const scopeParams = scopeAgentId ? [scopeAgentId] : [];
      const [statsResult, paymentsResult, overdueResult] = await Promise.allSettled([
        query(`
          SELECT
            COUNT(*)::int as total_leads,
            COUNT(*) FILTER (WHERE temperature = 'hot')::int as hot_leads,
            COUNT(*) FILTER (WHERE EXTRACT(MONTH FROM created_at) = EXTRACT(MONTH FROM NOW()) AND status = 'booked')::int as bookings_this_month,
            COALESCE(SUM(CASE WHEN status = 'booked' THEN budget ELSE 0 END), 0)::numeric as total_revenue
          FROM leads
          ${scopeAgentId ? 'WHERE agent_id = $1' : ''}
        `, scopeParams),
        query(`
          SELECT
            COUNT(*) FILTER (WHERE p.status = 'pending')::int as pending_payments,
            COUNT(*) FILTER (WHERE p.status = 'confirmed')::int as confirmed_payments
          FROM payments p
          JOIN leads l ON l.id = p.lead_id
          ${scopeAgentId ? 'WHERE l.agent_id = $1' : ''}
        `, scopeParams),
        query(`
          SELECT COUNT(*)::int as overdue_tasks
          FROM follow_ups f
          JOIN leads l ON l.id = f.lead_id
          ${scopeAgentId ? 'WHERE l.agent_id = $1' : ''} AND f.status != 'completed' AND f.due_date < NOW()
        `, scopeParams)
      ]);

      const stats = statsResult.status === 'fulfilled' ? statsResult.value.rows[0] : null;
      const payments = paymentsResult.status === 'fulfilled' ? paymentsResult.value.rows[0] : null;
      const overdueTasks = overdueResult.status === 'fulfilled' ? overdueResult.value.rows[0] : null;
      const confirmedRevenue = parseFloat(stats?.total_revenue) || 0;
      const targetSummary = calculateMonthlyTargetProgress(confirmedRevenue);

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
        totalRevenue: confirmedRevenue,
        monthlyTarget: targetSummary.monthlyTarget,
        monthlyTargetAchieved: targetSummary.monthlyTargetAchieved,
        monthlyTargetProgress: targetSummary.monthlyTargetProgress,
        monthlyTargetRemaining: targetSummary.monthlyTargetRemaining,
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
      const scopeAgentId = getLeadScopeAgentId(req.user?.role, req.user?.id);
      const result = await query(`
        SELECT status, COUNT(*) as count, temperature
        FROM leads
        ${scopeAgentId ? 'WHERE agent_id = $1' : ''}
        GROUP BY status, temperature
        ORDER BY status
      `, scopeAgentId ? [scopeAgentId] : []);

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
      const scopeAgentId = getLeadScopeAgentId(req.user?.role, req.user?.id);
      const result = await query(`
        SELECT
          COUNT(*) FILTER (WHERE status IN ('booked', 'completed')) as completed_bookings,
          COUNT(*) FILTER (WHERE status IN ('negotiation')) as in_negotiation,
          COUNT(*) FILTER (WHERE status = 'new') as new_leads
        FROM leads
        ${scopeAgentId ? 'WHERE agent_id = $1' : ''}
      `, scopeAgentId ? [scopeAgentId] : []);

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
  },

  async getAgentQuickSummary(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { agentId, startDate, endDate } = req.query;

      if (!canAccessAdminLikeAnalytics(req.user?.role)) {
        return res.status(403).json({ message: 'Admin or Manager access required' });
      }

      if (!agentId) {
        return res.status(400).json({ message: 'agentId is required' });
      }

      // Parse dates and ensure the range covers full days (start at 00:00:00, end at 23:59:59.999)
      const start = startDate ? new Date(String(startDate)) : new Date(new Date().setFullYear(new Date().getFullYear() - 1));
      if (startDate) start.setHours(0, 0, 0, 0);
      const end = endDate ? new Date(String(endDate)) : new Date();
      if (endDate) end.setHours(23, 59, 59, 999);

      // Ensure valid dates
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        return res.status(400).json({ message: 'Invalid date format' });
      }

      const result = await query(`
        SELECT
          -- Lead statuses (mutually exclusive categories)
          COUNT(*) FILTER (WHERE status = 'booked')::int as confirmed_leads,
          COUNT(*) FILTER (WHERE status IN ('negotiation', 'interested', 'contacted'))::int as in_progress_leads,
          COUNT(*) FILTER (WHERE status = 'completed')::int as completed_leads,
          COUNT(*) FILTER (WHERE status = 'spam')::int as spam_leads,
          COUNT(*) FILTER (WHERE status = 'canceled')::int as canceled_leads,
          COUNT(*) FILTER (WHERE temperature = 'dead' OR status IN ('completed','canceled'))::int as dead_leads,
          COUNT(*) FILTER (WHERE potential = true AND status NOT IN ('booked', 'completed', 'canceled', 'negotiation', 'interested', 'contacted'))::int as potential_leads,
          COUNT(*) FILTER (WHERE temperature = 'cold' AND status = 'new' AND potential = false)::int as pan_leads,
          COUNT(*) FILTER (WHERE status = 'new' AND potential = false AND temperature IS DISTINCT FROM 'cold')::int as new_leads,
          COUNT(*)::int as total_leads,
          -- Follow-up stats (follow-ups created in selected date range for this agent)
          (SELECT COUNT(*)::int FROM follow_ups f WHERE f.lead_id IN (SELECT id FROM leads l WHERE l.agent_id = $1) AND f.created_at >= $2 AND f.created_at <= $3)::int as total_followups,
          (SELECT COUNT(*)::int FROM follow_ups f WHERE f.lead_id IN (SELECT id FROM leads l WHERE l.agent_id = $1) AND f.created_at >= $2 AND f.created_at <= $3 AND f.status = 'completed')::int as completed_followups,
          (SELECT COUNT(*)::int FROM follow_ups f WHERE f.lead_id IN (SELECT id FROM leads l WHERE l.agent_id = $1) AND f.created_at >= $2 AND f.created_at <= $3 AND f.status IN ('overdue', 'today'))::int as past_due_followups,
          (SELECT COUNT(*)::int FROM follow_ups f WHERE f.lead_id IN (SELECT id FROM leads l WHERE l.agent_id = $1) AND f.created_at >= $2 AND f.created_at <= $3 AND f.status = 'upcoming')::int as active_followups
        FROM leads l
        WHERE l.agent_id = $1 AND l.created_at >= $2 AND l.created_at <= $3
      `, [agentId, start.toISOString(), end.toISOString()]);

      const stats = result.rows[0] || {};

      res.json({
        confirmedLeads: parseInt(stats.confirmed_leads) || 0,
        inProgressLeads: parseInt(stats.in_progress_leads) || 0,
        potentialLeads: parseInt(stats.potential_leads) || 0,
        newLeads: parseInt(stats.new_leads) || 0,
        spamLeads: parseInt(stats.spam_leads) || 0,
        canceledLeads: parseInt(stats.canceled_leads) || 0,
        panLeads: parseInt(stats.pan_leads) || 0,
        totalLeads: parseInt(stats.total_leads) || 0,
        deadLeads: parseInt(stats.dead_leads) || 0,
        totalFollowups: parseInt(stats.total_followups) || 0,
        completedFollowups: parseInt(stats.completed_followups) || 0,
        pastDueFollowups: parseInt(stats.past_due_followups) || 0,
        activeFollowups: parseInt(stats.active_followups) || 0
      });
    } catch (error) {
      next(error);
    }
  }
};
