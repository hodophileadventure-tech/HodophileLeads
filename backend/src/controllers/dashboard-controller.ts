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

const normalizeDashboardRole = (role?: string) => {
  const normalizedRole = String(role || '').toLowerCase().replace(/\s+/g, '_');
  return normalizedRole === 'quality_assurance' ? 'qa' : normalizedRole;
};

export const canAccessAdminLikeAnalytics = (role?: string) => {
  const normalizedRole = normalizeDashboardRole(role);
  return normalizedRole === 'admin' || normalizedRole === 'manager' || normalizedRole === 'qa';
};

export const canAccessOwnAnalytics = (role?: string) => normalizeDashboardRole(role) === 'agent';

export const getLeadScopeAgentId = (role?: string, userId?: string) => {
  return role === 'agent' ? userId : undefined;
};

export const dashboardController = {
  async getStats(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const scopeAgentId = getLeadScopeAgentId(req.user?.role, req.user?.id);
      const scopeParams = scopeAgentId ? [scopeAgentId] : [];
      const [statsResult, paymentsResult, overdueResult, revenueResult] = await Promise.allSettled([
        query(`
          SELECT
            COUNT(*)::int as total_leads,
            COUNT(*) FILTER (WHERE temperature = 'hot')::int as hot_leads,
              COUNT(*) FILTER (WHERE EXTRACT(MONTH FROM created_at) = EXTRACT(MONTH FROM NOW()) AND status = 'booked')::int as bookings_this_month,
              COUNT(*) FILTER (WHERE status = 'booked' OR lead_outcome = 'confirmed' OR pipeline_stage = 'confirmed')::int as total_confirmed
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
        `, scopeParams),
        query(`
          SELECT COALESCE(SUM(CASE WHEN actual_price > 0 THEN actual_price ELSE 0 END), 0)::numeric as total_revenue
          FROM leads
          WHERE (status = 'booked' OR lead_outcome = 'confirmed' OR pipeline_stage = 'confirmed')
          ${scopeAgentId ? 'AND agent_id = $1' : ''}
        `, scopeParams)
      ]);

      const stats = statsResult.status === 'fulfilled' ? statsResult.value.rows[0] : null;
      const payments = paymentsResult.status === 'fulfilled' ? paymentsResult.value.rows[0] : null;
      const overdueTasks = overdueResult.status === 'fulfilled' ? overdueResult.value.rows[0] : null;
      const revenue = revenueResult.status === 'fulfilled' ? revenueResult.value.rows[0] : null;
      const confirmedRevenue = parseFloat(revenue?.total_revenue) || 0;
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
      if (revenueResult.status === 'rejected') {
        console.error('[Dashboard] revenue query failed', revenueResult.reason);
      }

      res.json({
        totalLeads: parseInt(stats?.total_leads) || 0,
        hotLeads: parseInt(stats?.hot_leads) || 0,
        bookingsThisMonth: parseInt(stats?.bookings_this_month) || 0,
        totalConfirmed: parseInt(stats?.total_confirmed) || 0,
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

      if (!canAccessAdminLikeAnalytics(req.user?.role) && !canAccessOwnAnalytics(req.user?.role)) {
        return res.status(403).json({ message: 'Analytics access required' });
      }

      const resolvedAgentId = req.user?.role === 'agent' ? req.user?.id : agentId ? String(agentId) : undefined;

      if (!resolvedAgentId) {
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
          COUNT(*) FILTER (WHERE temperature = 'dead' AND status NOT IN ('completed','canceled'))::int as dead_leads,
          COUNT(*) FILTER (WHERE potential = true AND status NOT IN ('booked', 'completed', 'canceled', 'negotiation', 'interested', 'contacted', 'spam') AND temperature IS DISTINCT FROM 'dead')::int as potential_leads,
          COUNT(*) FILTER (WHERE temperature = 'cold' AND status = 'new' AND potential = false)::int as pan_leads,
          COUNT(*) FILTER (WHERE status = 'new' AND potential = false AND temperature IS DISTINCT FROM 'cold')::int as new_leads,
          COUNT(*)::int as total_leads,
          -- Follow-up stats use due dates because stored status can lag behind the calendar.
          (SELECT COUNT(*)::int FROM follow_ups f WHERE f.lead_id IN (SELECT id FROM leads l WHERE l.agent_id = $1) AND f.created_at >= $2 AND f.created_at <= $3)::int as total_followups,
          (SELECT COUNT(*)::int FROM follow_ups f WHERE f.lead_id IN (SELECT id FROM leads l WHERE l.agent_id = $1) AND f.created_at >= $2 AND f.created_at <= $3 AND f.status = 'completed')::int as completed_followups,
          (SELECT COUNT(*)::int FROM follow_ups f WHERE f.lead_id IN (SELECT id FROM leads l WHERE l.agent_id = $1) AND f.created_at >= $2 AND f.created_at <= $3 AND f.status NOT IN ('completed', 'canceled') AND f.due_date < NOW())::int as past_due_followups,
          (SELECT COUNT(*)::int FROM follow_ups f WHERE f.lead_id IN (SELECT id FROM leads l WHERE l.agent_id = $1) AND f.created_at >= $2 AND f.created_at <= $3 AND f.status NOT IN ('completed', 'canceled') AND f.due_date >= NOW() AND f.due_date < NOW() + INTERVAL '1 day')::int as due_followups,
          (SELECT COUNT(*)::int FROM follow_ups f WHERE f.lead_id IN (SELECT id FROM leads l WHERE l.agent_id = $1) AND f.created_at >= $2 AND f.created_at <= $3 AND f.status NOT IN ('completed', 'canceled') AND f.due_date < NOW())::int as overdue_followups,
          (SELECT COUNT(*)::int FROM follow_ups f WHERE f.lead_id IN (SELECT id FROM leads l WHERE l.agent_id = $1) AND f.created_at >= $2 AND f.created_at <= $3 AND f.status NOT IN ('completed', 'canceled') AND f.due_date >= NOW() + INTERVAL '1 day')::int as active_followups
        FROM leads l
        WHERE l.agent_id = $1
          AND l.created_at <= $3
          AND EXISTS (
            SELECT 1
            FROM audit_logs al
            WHERE al.entity_type = 'lead'
              AND al.entity_id = l.id
              AND al.created_at >= $2
              AND al.created_at <= $3
              AND (al.user_id = $1 OR al.changes->>'agentId' = $1::text)
          )
      `, [resolvedAgentId, start.toISOString(), end.toISOString()]);

      const stats = result.rows[0] || {};

      res.json({
        confirmedLeads: parseInt(stats.confirmed_leads) || 0,
        inProgressLeads: parseInt(stats.in_progress_leads) || 0,
        completedLeads: parseInt(stats.completed_leads) || 0,
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
        dueFollowups: parseInt(stats.due_followups) || 0,
        overdueFollowups: parseInt(stats.overdue_followups) || 0,
        activeFollowups: parseInt(stats.active_followups) || 0
      });
    } catch (error) {
      next(error);
    }
  },

  async getAgentSummaryDetails(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { agentId, section, startDate, endDate } = req.query;

      if (!canAccessAdminLikeAnalytics(req.user?.role) && !canAccessOwnAnalytics(req.user?.role)) {
        return res.status(403).json({ message: 'Analytics access required' });
      }

      const resolvedAgentId = req.user?.role === 'agent' ? req.user?.id : agentId ? String(agentId) : undefined;

      if (!resolvedAgentId || !section) {
        return res.status(400).json({ message: 'agentId and section are required' });
      }

      const validSections = new Set([
        'totalLeads',
        'confirmedLeads',
        'inProgressLeads',
        'completedLeads',
        'potentialLeads',
        'newLeads',
        'deadLeads',
        'spamLeads',
        'canceledLeads',
        'panLeads',
        'totalFollowups',
        'completedFollowups',
        'dueFollowups',
        'overdueFollowups',
        'pastDueFollowups',
        'activeFollowups'
      ]);

      if (!validSections.has(String(section))) {
        return res.status(400).json({ message: 'Invalid section' });
      }

      const start = startDate ? new Date(String(startDate)) : new Date(new Date().setFullYear(new Date().getFullYear() - 1));
      if (startDate) start.setHours(0, 0, 0, 0);
      const end = endDate ? new Date(String(endDate)) : new Date();
      if (endDate) end.setHours(23, 59, 59, 999);

      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        return res.status(400).json({ message: 'Invalid date format' });
      }

      const followUpSections = new Set(['totalFollowups', 'completedFollowups', 'dueFollowups', 'overdueFollowups', 'pastDueFollowups', 'activeFollowups']);
      if (followUpSections.has(String(section))) {
        const followUpFilters: Record<string, string> = {
          totalFollowups: 'TRUE',
          completedFollowups: `fu.status = 'completed'`,
          dueFollowups: `fu.status NOT IN ('completed', 'canceled') AND fu.due_date >= NOW() AND fu.due_date < NOW() + INTERVAL '1 day'`,
          overdueFollowups: `fu.status NOT IN ('completed', 'canceled') AND fu.due_date < NOW()`,
          pastDueFollowups: `fu.status NOT IN ('completed', 'canceled') AND fu.due_date < NOW()`,
          activeFollowups: `fu.status NOT IN ('completed', 'canceled') AND fu.due_date >= NOW() + INTERVAL '1 day'`
        };
        const followUpResult = await query(`
          SELECT
            fu.id,
            fu.title,
            fu.description,
            fu.status,
            fu.priority,
            fu.due_date,
            fu.completed_at,
            fu.completion_notes,
            fu.action_plan,
            l.id AS lead_id,
            l.client_name,
            l.phone,
            l.destination
          FROM follow_ups fu
          JOIN leads l ON l.id = fu.lead_id
          WHERE l.agent_id = $1
            AND (${followUpFilters[String(section)]})
            AND fu.created_at >= $2
            AND fu.created_at <= $3
          ORDER BY fu.due_date ASC NULLS LAST, fu.created_at DESC
          LIMIT 500
        `, [resolvedAgentId, start.toISOString(), end.toISOString()]);

        return res.json(followUpResult.rows);
      }

      const sectionFilters: Record<string, string> = {
        totalLeads: 'TRUE',
        confirmedLeads: `status = 'booked'`,
        inProgressLeads: `status IN ('negotiation', 'interested', 'contacted')`,
        completedLeads: `status = 'completed'`,
        potentialLeads: `potential = true AND status NOT IN ('booked', 'completed', 'canceled', 'negotiation', 'interested', 'contacted', 'spam') AND temperature IS DISTINCT FROM 'dead'`,
        newLeads: `status = 'new' AND potential = false AND temperature IS DISTINCT FROM 'cold'`,
        deadLeads: `temperature = 'dead' AND status NOT IN ('completed','canceled')`,
        spamLeads: `status = 'spam'`,
        canceledLeads: `status = 'canceled'`,
        panLeads: `temperature = 'cold' AND status = 'new' AND potential = false`
      };

      const result = await query(`
        SELECT
          l.id,
          l.client_name,
          l.phone,
          l.destination,
          l.status,
          l.temperature,
          l.canceled_reason,
          l.agent_remarks,
          l.remarks,
          l.created_at,
          l.updated_at,
          fu.title AS follow_up_title,
          fu.description AS follow_up_description,
          COALESCE(fu.completion_notes, l.agent_remarks) AS completion_notes,
          fu.action_plan
        FROM leads l
        LEFT JOIN LATERAL (
          SELECT
            STRING_AGG(NULLIF(title, ''), ' | ' ORDER BY due_date ASC NULLS LAST, created_at DESC) AS title,
            STRING_AGG(NULLIF(description, ''), E'\n\n' ORDER BY due_date ASC NULLS LAST, created_at DESC) AS description,
            STRING_AGG(NULLIF(COALESCE(completion_notes, audit_completion_notes), ''), E'\n\n' ORDER BY due_date ASC NULLS LAST, created_at DESC) AS completion_notes,
            STRING_AGG(NULLIF(action_plan, ''), E'\n\n' ORDER BY due_date ASC NULLS LAST, created_at DESC) AS action_plan
          FROM (
            SELECT
              f.title,
              f.description,
              f.completion_notes,
              f.action_plan,
              f.due_date,
              f.created_at,
              audit.completion_notes AS audit_completion_notes
            FROM follow_ups f
            LEFT JOIN LATERAL (
              SELECT STRING_AGG(
                NULLIF(changes->>'completionNotes', ''),
                E'\n\n' ORDER BY created_at DESC
              ) AS completion_notes
              FROM audit_logs
              WHERE entity_type = 'follow_up'
                AND entity_id = f.id
                AND action = 'complete'
            ) audit ON true
            WHERE f.lead_id = l.id
          ) follow_up_rows
        ) fu ON true
        WHERE l.agent_id = $1
          AND (${sectionFilters[String(section)]})
          AND l.created_at <= $3
          AND EXISTS (
            SELECT 1
            FROM audit_logs al
            WHERE al.entity_type = 'lead'
              AND al.entity_id = l.id
              AND al.created_at >= $2
              AND al.created_at <= $3
              AND (al.user_id = $1 OR al.changes->>'agentId' = $1::text)
          )
        ORDER BY l.updated_at DESC
        LIMIT 200
      `, [resolvedAgentId, start.toISOString(), end.toISOString()]);

      res.json(result.rows);
    } catch (error) {
      next(error);
    }
  }
};
