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
      const result = await query('SELECT id, email, name, role FROM users');
      res.json({ agents: result.rows });
    } catch (err) {
      next(err);
    }
  },

  async getAgentLeads(req: any, res: any, next: any) {
    try {
      const agentId = req.params.id;
      const result = await query('SELECT * FROM leads WHERE agent_id = $1 ORDER BY created_at DESC', [agentId]);
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
