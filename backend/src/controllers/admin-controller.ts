import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { followUpsModel } from '../models/FollowUp';
import { query } from '../utils/database';
import { hashPassword } from '../utils/auth';

// simple random password generator
const generateTempPassword = () => Math.random().toString(36).slice(-10);

export const adminController = {
  async listAgents(req: any, res: any, next: any) {
    try {
      const result = await query("SELECT id, email, name, role, last_login_at, last_logout_at FROM users WHERE role = 'agent' ORDER BY created_at DESC");
      res.json({ agents: result.rows });
    } catch (err) {
      next(err);
    }
  },

  async overview(req: any, res: any, next: any) {
    try {
      const summaryResult = await query(`
        SELECT
          COUNT(*) FILTER (WHERE DATE(created_at) = CURRENT_DATE) AS today_leads,
          COUNT(*) AS total_leads,
          COUNT(*) FILTER (WHERE status = 'canceled') AS canceled_leads
        FROM leads
      `);

      const canceledFollowUpsCount = await query(`
        SELECT COUNT(*) AS canceled_followups
        FROM follow_ups
        WHERE status = 'canceled'
      `);

      const agentResult = await query(`
        WITH lead_stats AS (
          SELECT
            agent_id,
            COUNT(*) AS total_leads,
            COUNT(*) FILTER (WHERE DATE(created_at) = CURRENT_DATE) AS today_leads,
            COUNT(*) FILTER (WHERE status = 'canceled') AS canceled_leads
          FROM leads
          GROUP BY agent_id
        ),
        followup_stats AS (
          SELECT
            l.agent_id,
            COUNT(*) FILTER (WHERE f.status = 'canceled') AS canceled_followups
          FROM follow_ups f
          JOIN leads l ON l.id = f.lead_id
          GROUP BY l.agent_id
        )
        SELECT
          u.id,
          u.email,
          u.name,
          u.role,
          u.last_login_at,
          u.last_logout_at,
          COALESCE(ls.total_leads, 0) AS total_leads,
          COALESCE(ls.today_leads, 0) AS today_leads,
          COALESCE(ls.canceled_leads, 0) AS canceled_leads,
          COALESCE(fs.canceled_followups, 0) AS canceled_followups
        FROM users u
        LEFT JOIN lead_stats ls ON ls.agent_id = u.id
        LEFT JOIN followup_stats fs ON fs.agent_id = u.id
        WHERE u.role = 'agent'
        ORDER BY u.role DESC, u.name ASC
      `);

      const leadsResult = await query(`
        SELECT
          l.id,
          l.client_name,
          l.email,
          l.phone,
          l.destination,
          l.status,
          l.temperature,
          l.created_at,
          l.updated_at,
          l.agent_id,
          u.name AS agent_name,
          u.email AS agent_email,
          l.canceled_reason,
          l.canceled_at,
          cu.name AS canceled_by_name,
          cu.email AS canceled_by_email,
          COALESCE(f.follow_up_count, 0) AS follow_up_count,
          COALESCE(f.canceled_followups, 0) AS canceled_followups
        FROM leads l
        JOIN users u ON u.id = l.agent_id
        LEFT JOIN users cu ON cu.id = l.canceled_by
        LEFT JOIN (
          SELECT
            lead_id,
            COUNT(*) AS follow_up_count,
            COUNT(*) FILTER (WHERE status = 'canceled') AS canceled_followups
          FROM follow_ups
          GROUP BY lead_id
        ) f ON f.lead_id = l.id
        ORDER BY u.name ASC, l.created_at DESC
      `);

      const canceledLeadsResult = await query(`
        SELECT
          l.id,
          l.client_name,
          l.email,
          l.phone,
          l.destination,
          l.canceled_reason,
          l.canceled_at,
          l.agent_id,
          ua.name AS agent_name,
          ua.email AS agent_email,
          cu.name AS canceled_by_name,
          cu.email AS canceled_by_email
        FROM leads l
        JOIN users ua ON ua.id = l.agent_id
        LEFT JOIN users cu ON cu.id = l.canceled_by
        WHERE l.status = 'canceled'
        ORDER BY l.canceled_at DESC NULLS LAST, l.created_at DESC
      `);

      const canceledFollowUpsResult = await query(`
        SELECT
          f.id,
          f.title,
          f.description,
          f.canceled_reason,
          f.canceled_at,
          f.lead_id,
          l.client_name,
          l.agent_id,
          ua.name AS agent_name,
          ua.email AS agent_email,
          cu.name AS canceled_by_name,
          cu.email AS canceled_by_email
        FROM follow_ups f
        JOIN leads l ON l.id = f.lead_id
        JOIN users ua ON ua.id = l.agent_id
        LEFT JOIN users cu ON cu.id = f.canceled_by
        WHERE f.status = 'canceled'
        ORDER BY f.canceled_at DESC NULLS LAST, f.created_at DESC
      `);

      res.json({
        summary: {
          todayLeads: Number(summaryResult.rows[0]?.today_leads || 0),
          totalLeads: Number(summaryResult.rows[0]?.total_leads || 0),
          canceledLeads: Number(summaryResult.rows[0]?.canceled_leads || 0),
          canceledFollowUps: Number(canceledFollowUpsCount.rows[0]?.canceled_followups || 0)
        },
        agents: agentResult.rows,
        leads: leadsResult.rows,
        canceledLeads: canceledLeadsResult.rows,
        canceledFollowUps: canceledFollowUpsResult.rows
      });
    } catch (err) {
      next(err);
    }
  },

  async getAgentLeads(req: any, res: any, next: any) {
    try {
      const agentId = req.params.id;
      const result = await query(`
        SELECT l.*, u.name AS agent_name, u.email AS agent_email
        FROM leads l
        JOIN users u ON u.id = l.agent_id
        WHERE l.agent_id = $1
        ORDER BY l.created_at DESC
      `, [agentId]);
      res.json({ leads: result.rows });
    } catch (err) {
      next(err);
    }
  },

  async updateAgent(req: any, res: any, next: any) {
    try {
      const agentId = req.params.id;
      const { email, name } = req.body;
      const result = await query('UPDATE users SET email = $1, name = $2, updated_at = NOW() WHERE id = $3 RETURNING id, email, name, role', [email, name, agentId]);
      res.json({ agent: result.rows[0] });
    } catch (err) {
      next(err);
    }
  },

  async resetAgentPassword(req: any, res: any, next: any) {
    try {
      const agentId = req.params.id;
      const temp = generateTempPassword();
      const hashed = await hashPassword(temp);
      await query('UPDATE users SET password = $1, updated_at = NOW() WHERE id = $2', [hashed, agentId]);
      // return temp password once
      res.json({ tempPassword: temp });
    } catch (err) {
      next(err);
    }
  },

  async followUpStats(req: any, res: any, next: any) {
    try {
      const sql = `
        SELECT u.id as agent_id, u.name, COUNT(f.id) as total,
          SUM(CASE WHEN f.status != 'completed' AND f.due_date < NOW() THEN 1 ELSE 0 END) as overdue,
          SUM(CASE WHEN f.status != 'completed' AND f.due_date >= NOW() THEN 1 ELSE 0 END) as pending,
          SUM(CASE WHEN f.status = 'completed' THEN 1 ELSE 0 END) as completed
        FROM users u
        LEFT JOIN follow_ups f ON u.id = f.assigned_to
        GROUP BY u.id, u.name
        ORDER BY overdue DESC NULLS LAST, total DESC
      `;

      const result = await query(sql);
      res.json({ stats: result.rows });
    } catch (err) {
      next(err);
    }
  },

  async revenueStats(req: any, res: any, next: any) {
    try {
      const sql = `
        SELECT u.id as agent_id, u.name,
          COALESCE(SUM(COALESCE(l.budget,0)),0) as total_revenue,
          COUNT(l.id) as bookings
        FROM users u
        LEFT JOIN leads l ON u.id = l.agent_id AND (l.status = 'booked' OR l.status = 'completed')
        GROUP BY u.id, u.name
        ORDER BY total_revenue DESC NULLS LAST
      `;

      const result = await query(sql);
      res.json({ stats: result.rows });
    } catch (err) {
      next(err);
    }
  },

  async redFlags(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const overdueFollowUps = await followUpsModel.findOverdue();

      const quotedStuck = await query(
        "SELECT * FROM leads WHERE (pipeline_stage = 'quoted' OR status = 'negotiation') AND created_at < NOW() - INTERVAL '72 hours'"
      );

      const expiredHolds = await query(
        "SELECT * FROM availability WHERE hold_expiry IS NOT NULL AND hold_expiry < NOW() AND (hotel_status = 'on_hold' OR transport_status = 'on_hold' OR guide_status = 'on_hold')"
      );

      res.json({
        overdueFollowUps,
        quotedStuck: quotedStuck.rows,
        expiredHolds: expiredHolds.rows,
        counts: {
          overdueFollowUps: overdueFollowUps.length,
          quotedStuck: quotedStuck.rows.length,
          expiredHolds: expiredHolds.rows.length
        }
      });
    } catch (error) {
      next(error);
    }
  }
};
