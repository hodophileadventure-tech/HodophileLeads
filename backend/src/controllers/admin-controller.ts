import { Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import ExcelJS from 'exceljs';
import { AuthenticatedRequest } from '../middleware/auth';
import { followUpsModel } from '../models/FollowUp';
import { screenCaptureModel } from '../models/ScreenCapture';
import { query, getClient } from '../utils/database';
import { hashPassword } from '../utils/auth';
import { consumeScreenCaptureRequest, createScreenCaptureRequest, getScreenCaptureRequest, sendToUser } from '../utils/wsServer';

type LeadOutcomeBucket = 'confirmed' | 'budget_issue' | 'no_reply';

const getLeadOutcomeBucket = (lead: any): LeadOutcomeBucket => {
  const explicitOutcome = String(lead.lead_outcome || lead.leadOutcome || '').trim();
  if (explicitOutcome === 'confirmed') return 'confirmed';
  if (explicitOutcome === 'budget_issue') return 'budget_issue';
  if (explicitOutcome === 'no_reply') return 'no_reply';
  if (lead.pipelineStage === 'confirmed' || lead.status === 'booked') return 'confirmed';
  return 'no_reply';
};

// simple random password generator
const generateTempPassword = () => Math.random().toString(36).slice(-10);

export const adminController = {
  async exportLeadsSpreadsheet(req: any, res: any, next: any) {
    try {
      const result = await query(`
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
          l.lead_outcome,
          l.canceled_reason,
          l.canceled_at,
          COALESCE(f.follow_up_count, 0) AS follow_up_count,
          COALESCE(f.canceled_followups, 0) AS canceled_followups
        FROM leads l
        JOIN users u ON u.id = l.agent_id
        LEFT JOIN (
          SELECT
            lead_id,
            COUNT(*) AS follow_up_count,
            COUNT(*) FILTER (WHERE status = 'canceled') AS canceled_followups
          FROM follow_ups
          GROUP BY lead_id
        ) f ON f.lead_id = l.id
        ORDER BY u.name ASC, l.status ASC, l.temperature ASC, l.created_at DESC
      `);

      const rows = Array.isArray(result.rows) ? result.rows : [];
      const headers = [
        'Lead ID',
        'Client Name',
        'Email',
        'Phone',
        'Destination',
        'Status',
        'Temperature',
        'Agent Name',
        'Agent Email',
        'Created At',
        'Updated At',
        'Canceled Reason',
        'Canceled At',
        'Follow Up Count',
        'Canceled Follow Ups'
      ];

      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'TRIPNEXUS';
      workbook.created = new Date();
      workbook.modified = new Date();

      const categorizedRows = {
        confirmed: rows.filter((row: any) => getLeadOutcomeBucket(row) === 'confirmed'),
        budget_issue: rows.filter((row: any) => getLeadOutcomeBucket(row) === 'budget_issue'),
        no_reply: rows.filter((row: any) => getLeadOutcomeBucket(row) === 'no_reply')
      };

      const createSheet = (sheetName: string, dataRows: any[]) => {
        const sheet = workbook.addWorksheet(sheetName);
        sheet.columns = headers.map((header) => ({ header, key: header, width: Math.max(16, header.length + 4) }));
        sheet.getRow(1).font = { bold: true };
        sheet.views = [{ state: 'frozen', ySplit: 1 }];

        for (const row of dataRows) {
          sheet.addRow({
            'Lead ID': row.id,
            'Client Name': row.client_name,
            Email: row.email,
            Phone: row.phone,
            Destination: row.destination,
            Status: row.status,
            Temperature: row.temperature,
            'Agent Name': row.agent_name,
            'Agent Email': row.agent_email,
            'Created At': row.created_at,
            'Updated At': row.updated_at,
            'Canceled Reason': row.canceled_reason,
            'Canceled At': row.canceled_at,
            'Follow Up Count': Number(row.follow_up_count || 0),
            'Canceled Follow Ups': Number(row.canceled_followups || 0)
          });
        }

        sheet.autoFilter = {
          from: 'A1',
          to: `${String.fromCharCode(64 + headers.length)}1`
        };
      };

      createSheet('Confirmed Leads', categorizedRows.confirmed);
      createSheet('Budget Issue', categorizedRows.budget_issue);
      createSheet('No Reply', categorizedRows.no_reply);

      const buffer = await workbook.xlsx.writeBuffer();
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="tripnexus-leads-${new Date().toISOString().slice(0, 10)}.xlsx"`);
      res.send(Buffer.from(buffer));
    } catch (err) {
      next(err);
    }
  },

  async listAgents(req: any, res: any, next: any) {
    try {
      const result = await query("SELECT id, email, name, role, last_login_at, last_logout_at FROM users WHERE role = 'agent' ORDER BY created_at DESC");
      res.json({ agents: result.rows });
    } catch (err) {
      next(err);
    }
  },

  async deleteAgent(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    const agentId = req.params.id;
    const client = await getClient();

    try {
      await client.query('BEGIN');
      // Clean up or detach references that do not cascade automatically
      await client.query('DELETE FROM quote_requests WHERE requested_by = $1', [agentId]);
      await client.query('UPDATE quote_requests SET resolved_by = NULL WHERE resolved_by = $1', [agentId]);
      await client.query('DELETE FROM follow_ups WHERE assigned_to = $1', [agentId]);
      await client.query('UPDATE follow_ups SET canceled_by = NULL WHERE canceled_by = $1', [agentId]);
      await client.query('DELETE FROM screen_captures WHERE agent_id = $1', [agentId]);
      await client.query('DELETE FROM leads WHERE agent_id = $1', [agentId]);
      await client.query('UPDATE leads SET canceled_by = NULL WHERE canceled_by = $1', [agentId]);
      await client.query('UPDATE notifications SET user_id = NULL WHERE user_id = $1', [agentId]);
      await client.query('UPDATE attachments SET uploaded_by = NULL WHERE uploaded_by = $1', [agentId]);
      await client.query('UPDATE screen_captures SET requested_by = NULL WHERE requested_by = $1', [agentId]);
      await client.query('UPDATE audit_logs SET user_id = NULL WHERE user_id = $1', [agentId]);

      const result = await client.query("DELETE FROM users WHERE id = $1 AND role = 'agent' RETURNING id", [agentId]);
      if (!result.rowCount) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: 'Agent not found or cannot delete admin user' });
      }
      await client.query('COMMIT');
      res.json({ success: true });
    } catch (err) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackErr) {
        console.error('Rollback failed while deleting agent:', rollbackErr);
      }
      next(err);
    } finally {
      client.release();
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

  async requestAgentScreenshot(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const adminId = String(req.user?.id || '');
      const agentId = String(req.params.id || '');

      const agentResult = await query('SELECT id FROM users WHERE id = $1 AND role = $2', [agentId, 'agent']);
      if (!agentResult.rows[0]) {
        return res.status(404).json({ message: 'Agent not found' });
      }

      const request = {
        requestId: randomUUID(),
        targetAgentId: agentId,
        requestedBy: adminId,
        requestedAt: new Date().toISOString()
      };

      console.log('[screen-capture-request]', request);

      createScreenCaptureRequest(request);
      sendToUser(agentId, 'screen-capture-request', request);

      res.json({ request });
    } catch (err) {
      next(err);
    }
  },

  async submitScreenCapture(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const agentId = String(req.user?.id || '');
      const requestId = String(req.params.requestId || '');
      const { dataUrl, error, capturedAt } = req.body || {};

      const request = getScreenCaptureRequest(requestId);
      if (!request) {
        return res.status(404).json({ message: 'Screenshot request expired or not found' });
      }

      if (request.targetAgentId !== agentId) {
        return res.status(403).json({ message: 'This request does not belong to the current agent' });
      }

      consumeScreenCaptureRequest(requestId);

      if (error) {
        console.log('[screen-capture-result]', {
          requestId,
          agentId,
          requestedBy: request.requestedBy,
          error,
          capturedAt: capturedAt || new Date().toISOString()
        });
        sendToUser(request.requestedBy, 'screen-capture-result', {
          requestId,
          agentId,
          error,
          capturedAt: capturedAt || new Date().toISOString()
        });
        return res.json({ ok: true });
      }

      if (!dataUrl) {
        return res.status(400).json({ message: 'Missing screenshot data' });
      }

      const matches = String(dataUrl).match(/^data:(image\/(?:png|jpeg));base64,(.+)$/);
      if (!matches) {
        return res.status(400).json({ message: 'Invalid screenshot payload' });
      }

      const mimeType = matches[1];
      const base64Data = matches[2];
      const extension = mimeType === 'image/jpeg' ? 'jpg' : 'png';
      const uploadDir = path.join(__dirname, '..', '..', 'uploads', 'screen-captures');
      fs.mkdirSync(uploadDir, { recursive: true });
      const fileName = `${requestId}.${extension}`;
      const filePath = path.join(uploadDir, fileName);
      const buffer = Buffer.from(base64Data, 'base64');
      fs.writeFileSync(filePath, buffer);

      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const screenshot = await screenCaptureModel.create({
        requestId,
        agentId,
        requestedBy: request.requestedBy,
        fileName,
        mimeType,
        url: `/uploads/screen-captures/${fileName}`,
        size: buffer.length,
        expiresAt
      });

      console.log('[screen-capture-result]', {
        requestId,
        agentId,
        requestedBy: request.requestedBy,
        capturedAt: capturedAt || new Date().toISOString()
      });

      sendToUser(request.requestedBy, 'screen-capture-result', {
        requestId,
        agentId,
        screenshot,
        capturedAt: capturedAt || new Date().toISOString()
      });

      res.json({ ok: true });
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
