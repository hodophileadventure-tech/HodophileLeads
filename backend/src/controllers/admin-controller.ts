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
import { logActivity } from '../utils/activity-log';
import { consumeScreenCaptureRequest, createScreenCaptureRequest, getScreenCaptureRequest, sendToUser } from '../utils/wsServer';
import { buildLeadExportFilters } from '../utils/export-date-range';

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
      const statusParam = String(req.query.status || '').trim().toLowerCase();
      const startDate = String(req.query.startDate || '').trim();
      const endDate = String(req.query.endDate || '').trim();
      const exportType = String(req.query.type || 'xlsx').trim().toLowerCase();

      let filterResult;
      try {
        filterResult = buildLeadExportFilters({ status: statusParam, startDate, endDate });
      } catch (error) {
        return res.status(400).json({ message: error instanceof Error ? error.message : 'Invalid export filter' });
      }

      const { whereClause, params } = filterResult;
      const statusFilter = statusParam && statusParam !== 'all' ? statusParam : undefined;

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
          to_char(l.created_at, 'YYYY-MM-DD HH24:MI:SS') AS created_time,
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
        LEFT JOIN users u ON u.id = l.agent_id
        LEFT JOIN (
          SELECT
            lead_id,
            COUNT(*) AS follow_up_count,
            COUNT(*) FILTER (WHERE status = 'canceled') AS canceled_followups
          FROM follow_ups
          GROUP BY lead_id
        ) f ON f.lead_id = l.id
        ${whereClause}
        ORDER BY u.name ASC, l.status ASC, l.temperature ASC, l.created_at DESC
      `, params);

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
        'Created Time',
        'Updated At',
        'Canceled Reason',
        'Canceled At',
        'Follow Up Count',
        'Canceled Follow Ups'
      ];

      const normalizedStatusLabel = statusFilter || 'all';

      if (exportType === 'txt') {
        const lines = rows.map((row: any) => [
          row.id,
          row.client_name,
          row.email,
          row.phone,
          row.destination,
          row.status,
          row.temperature,
          row.agent_name,
          row.agent_email,
          row.created_at,
          row.created_time,
          row.updated_at,
          row.canceled_reason,
          row.canceled_at,
          String(Number(row.follow_up_count || 0)),
          String(Number(row.canceled_followups || 0))
        ].map((value) => (value ?? '').toString().replace(/\t/g, ' ')).join('\t'));

        const headerLine = headers.join('\t');
        const content = [headerLine, ...lines].join('\n');
        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Content-Disposition', `attachment; filename="tripnexus-leads-${normalizedStatusLabel}-${new Date().toISOString().slice(0, 10)}.txt"`);
        return res.send(content);
      }

      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'TRIPNEXUS';
      workbook.created = new Date();
      workbook.modified = new Date();

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
            'Created Time': row.created_time,
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

      if (statusFilter) {
        createSheet(statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1) + ' Leads', rows);
      } else {
        const categorizedRows = {
          confirmed: rows.filter((row: any) => getLeadOutcomeBucket(row) === 'confirmed'),
          budget_issue: rows.filter((row: any) => getLeadOutcomeBucket(row) === 'budget_issue'),
          no_reply: rows.filter((row: any) => getLeadOutcomeBucket(row) === 'no_reply')
        };

        createSheet('Confirmed Leads', categorizedRows.confirmed);
        createSheet('Budget Issue', categorizedRows.budget_issue);
        createSheet('No Reply', categorizedRows.no_reply);
      }

      const buffer = await workbook.xlsx.writeBuffer();
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="tripnexus-leads-${normalizedStatusLabel}-${new Date().toISOString().slice(0, 10)}.xlsx"`);
      res.send(Buffer.from(buffer));
    } catch (err) {
      next(err);
    }
  },

  async listAgents(req: any, res: any, next: any) {
    try {
      const result = await query("SELECT id, email, name, role, last_login_at, last_logout_at, COALESCE(monthly_target, 5000000) AS monthly_target FROM users WHERE role IN ('agent', 'manager') ORDER BY created_at DESC");
      res.json({ agents: result.rows });
    } catch (err) {
      next(err);
    }
  },

  async deleteAgent(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    const agentId = req.params.id;
    
    console.log(`\n${'='.repeat(60)}`);
    console.log(`DELETE AGENT REQUEST RECEIVED`);
    console.log(`Timestamp: ${new Date().toISOString()}`);
    console.log(`Agent ID: ${agentId}`);
    console.log(`User: ${req.user?.id} (${req.user?.role})`);
    console.log(`${'='.repeat(60)}`);
    
    // Validate agentId
    if (!agentId || typeof agentId !== 'string') {
      console.log(`VALIDATION FAILED: Invalid agent ID`);
      return res.status(400).json({ message: 'Invalid agent ID' });
    }

    try {
      // Step 1: Check if agent exists
      console.log(`STEP 1: Checking if agent exists...`);
      const agentCheckResult = await query("SELECT id, role FROM users WHERE id = $1", [agentId]);
      console.log(`Query result:`, JSON.stringify(agentCheckResult, null, 2));
      
      if (!agentCheckResult?.rows?.length) {
        console.log(`NOT FOUND: No agent with ID ${agentId}`);
        return res.status(404).json({ message: 'Agent not found' });
      }
      
      const agent = agentCheckResult.rows[0];
      console.log(`FOUND: Agent - ID: ${agent.id}, Role: ${agent.role}`);
      
      if (agent.role !== 'agent' && agent.role !== 'manager') {
        console.log(`VALIDATION FAILED: User is ${agent.role}, not agent or manager`);
        return res.status(403).json({ message: 'Can only delete agent or manager users' });
      }

      // Step 2: Perform deletions
      console.log(`STEP 2: Starting data cleanup for agent...`);
      
      const deletionOps = [
        { desc: 'delete quote_requests by requested_by', sql: 'DELETE FROM quote_requests WHERE requested_by = $1' },
        { desc: 'delete follow_ups by assigned_to', sql: 'DELETE FROM follow_ups WHERE assigned_to = $1' },
        { desc: 'delete screen_captures by agent_id', sql: 'DELETE FROM screen_captures WHERE agent_id = $1' },
        { desc: 'delete leads by agent_id', sql: 'DELETE FROM leads WHERE agent_id = $1' },
        { desc: 'clear quote_requests.resolved_by', sql: 'UPDATE quote_requests SET resolved_by = NULL WHERE resolved_by = $1' },
        { desc: 'clear follow_ups.canceled_by', sql: 'UPDATE follow_ups SET canceled_by = NULL WHERE canceled_by = $1' },
        { desc: 'clear screen_captures.requested_by', sql: 'UPDATE screen_captures SET requested_by = NULL WHERE requested_by = $1' },
        { desc: 'clear notifications.user_id', sql: 'UPDATE notifications SET user_id = NULL WHERE user_id = $1' },
        { desc: 'clear leads.canceled_by', sql: 'UPDATE leads SET canceled_by = NULL WHERE canceled_by = $1' },
        { desc: 'clear attachments.uploaded_by', sql: 'UPDATE attachments SET uploaded_by = NULL WHERE uploaded_by = $1' },
        { desc: 'clear audit_logs.user_id', sql: 'UPDATE audit_logs SET user_id = NULL WHERE user_id = $1' },
        { desc: 'delete notifications for agent leads', sql: 'DELETE FROM notifications WHERE lead_id IN (SELECT id FROM leads WHERE agent_id = $1)' }
      ];
      
      for (let i = 0; i < deletionOps.length; i++) {
        const op = deletionOps[i];
        try {
          console.log(`  [${i + 1}/${deletionOps.length}] ${op.desc}...`);
          const result = await query(op.sql, [agentId]);
          console.log(`    ✓ OK (affected: ${result.rowCount || 0})`);
        } catch (opErr) {
          const msg = opErr instanceof Error ? opErr.message : String(opErr);
          console.error(`    ✗ FAILED: ${msg}`);
          throw new Error(`Operation "${op.desc}" failed: ${msg}`);
        }
      }

      // Step 3: Delete the user
      console.log(`STEP 3: Deleting user record...`);
      const deleteResult = await query(
        "DELETE FROM users WHERE id = $1 AND role IN ('agent', 'manager') RETURNING id",
        [agentId]
      );
      console.log(`Delete result:`, JSON.stringify(deleteResult, null, 2));
      
      if (!deleteResult?.rows?.length) {
        console.error(`FAILED: User record not deleted`);
        return res.status(500).json({ message: 'Failed to delete agent user record' });
      }
      
      console.log(`${'='.repeat(60)}`);
      console.log(`SUCCESS: Agent ${agentId} deleted completely`);
      console.log(`${'='.repeat(60)}\n`);
      
      return res.json({ success: true, message: 'Agent deleted successfully' });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error(`${'='.repeat(60)}`);
      console.error(`DELETION FAILED`);
      console.error(`Error: ${errorMsg}`);
      console.error(`Stack:`, err instanceof Error ? err.stack : 'N/A');
      console.error(`${'='.repeat(60)}\n`);
      
      return res.status(500).json({ 
        message: `Agent deletion failed: ${errorMsg}`,
        success: false,
        agentId
      });
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
      const { email, name, monthlyTarget } = req.body;
      const fields: string[] = [];
      const params: any[] = [];
      let idx = 1;
      if (email !== undefined) { fields.push(`email = $${idx}`); params.push(email); idx++; }
      if (name !== undefined) { fields.push(`name = $${idx}`); params.push(name); idx++; }
      if (monthlyTarget !== undefined) { fields.push(`monthly_target = $${idx}`); params.push(monthlyTarget); idx++; }

      if (fields.length === 0) return res.status(400).json({ message: 'No fields to update' });

      const sql = `UPDATE users SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${idx} RETURNING id, email, name, role, COALESCE(monthly_target, 5000000) AS monthly_target`;
      params.push(agentId);
      const result = await query(sql, params);
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

  // Issue reporting: create, list, update, upload attachment
  async createIssue(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { location, description } = req.body || {};
      const reporterRole = req.user?.role || 'admin';
      const reporterId = String(req.user?.id || '');
      const reporterName = String(req.user?.name || '');
      const reporterEmail = String(req.user?.email || '');
      const attachmentUrl = req.file ? `/uploads/issues/${req.file.filename}` : null;
      const createdAt = new Date().toISOString();

      const uploadDir = path.join(__dirname, '..', '..', 'uploads', 'issues');
      fs.mkdirSync(uploadDir, { recursive: true });

      if (process.env.DATABASE_URL) {
        try {
          const result = await query(
            `INSERT INTO issues (location, description, reporter_role, reporter_id, status, attachment_url, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING id, location, description, reporter_role, reporter_id, status, attachment_url, created_at, updated_at`,
            [location, description, reporterRole, reporterId || null, 'open', attachmentUrl, createdAt, createdAt]
          );
          return res.status(201).json(result.rows[0]);
        } catch (dbErr) {
          console.warn('DB insert for issue failed, falling back to file storage', (dbErr as any)?.message || String(dbErr));
          // continue to file fallback
        }
      }

      const filePath = path.join(uploadDir, 'issues.json');
      let list: any[] = [];
      try {
        const raw = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '[]';
        list = JSON.parse(raw || '[]');
      } catch {
        list = [];
      }

      const issue = {
        id: randomUUID(),
        location: location || null,
        description: description || null,
        reporter_role: reporterRole,
        reporter_id: reporterId || null,
        reporter_name: reporterName || null,
        reporter_email: reporterEmail || null,
        status: 'open',
        attachment_url: attachmentUrl,
        created_at: createdAt,
        updated_at: createdAt,
      };
      list.unshift(issue);
      fs.writeFileSync(filePath, JSON.stringify(list, null, 2), 'utf8');
      return res.status(201).json(issue);
    } catch (err) {
      next(err);
    }
  },

  async listIssues(_req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (process.env.DATABASE_URL) {
        try {
          const result = await query(`
            SELECT 
              i.id,
              i.location,
              i.description,
              i.reporter_role,
              i.reporter_id,
              i.status,
              i.attachment_url,
              i.created_at,
              i.updated_at,
              u.name AS reporter_name,
              u.email AS reporter_email
            FROM issues i
            LEFT JOIN users u ON u.id = i.reporter_id
            ORDER BY i.created_at DESC
          `);
          return res.json({ issues: result.rows });
        } catch (dbErr) {
          console.warn('DB select for issues failed, falling back to file storage', (dbErr as any)?.message || String(dbErr));
        }
      }

      const uploadDir = path.join(__dirname, '..', '..', 'uploads', 'issues');
      const filePath = path.join(uploadDir, 'issues.json');
      let list: any[] = [];
      try {
        const raw = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '[]';
        list = JSON.parse(raw || '[]');
      } catch (err) {
        list = [];
      }
      res.json({ issues: list });
    } catch (err) {
      next(err);
    }
  },

  async updateIssue(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const issueId = String(req.params.id || '');
      const data = req.body || {};

      if (process.env.DATABASE_URL) {
        try {
          const fields = [] as string[];
          const params: any[] = [];
          let idx = 1;
          for (const key of Object.keys(data)) {
            fields.push(`${key} = $${idx}`);
            params.push(data[key]);
            idx++;
          }
          if (fields.length) {
            const sql = `UPDATE issues SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${idx} RETURNING *`;
            params.push(issueId);
            const result = await query(sql, params);
            return res.json({ issue: result.rows[0] });
          }
        } catch (dbErr) {
          console.warn('DB update for issue failed, falling back to file storage', (dbErr as any)?.message || String(dbErr));
        }
      }

      const uploadDir = path.join(__dirname, '..', '..', 'uploads', 'issues');
      const filePath = path.join(uploadDir, 'issues.json');
      let list: any[] = [];
      try {
        const raw = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '[]';
        list = JSON.parse(raw || '[]');
      } catch {
        list = [];
      }

      const idx = list.findIndex((i) => String(i.id) === issueId);
      if (idx === -1) return res.status(404).json({ message: 'Issue not found' });
      list[idx] = { ...list[idx], ...data, updatedAt: new Date().toISOString() };
      fs.writeFileSync(filePath, JSON.stringify(list, null, 2), 'utf8');
      res.json({ issue: list[idx] });
    } catch (err) {
      next(err);
    }
  },

  async uploadIssueAttachment(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const issueId = String(req.params.id || '');
      const file = (req as any).file;
      if (!file) return res.status(400).json({ message: 'Missing file' });

      const attachmentUrl = `/uploads/issues/${file.filename}`;

      if (process.env.DATABASE_URL) {
        try {
          const sql = 'UPDATE issues SET attachment_url = $1, updated_at = NOW() WHERE id = $2 RETURNING *';
          const result = await query(sql, [attachmentUrl, issueId]);
          return res.json({ issue: result.rows[0] });
        } catch (dbErr) {
          console.warn('DB update for issue attachment failed, falling back to file storage', (dbErr as any)?.message || String(dbErr));
        }
      }

      const uploadDir = path.join(__dirname, '..', '..', 'uploads', 'issues');
      const filePath = path.join(uploadDir, 'issues.json');
      let list: any[] = [];
      try {
        const raw = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '[]';
        list = JSON.parse(raw || '[]');
      } catch {
        list = [];
      }
      const idx = list.findIndex((i) => String(i.id) === issueId);
      if (idx === -1) return res.status(404).json({ message: 'Issue not found' });
      list[idx] = { ...list[idx], attachmentUrl, updatedAt: new Date().toISOString() };
      fs.writeFileSync(filePath, JSON.stringify(list, null, 2), 'utf8');
      res.json({ issue: list[idx] });
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
          COUNT(l.id) as bookings,
          COALESCE(u.monthly_target, 5000000) AS monthly_target
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

  async transferLead(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const leadId = req.params.id;
      const { targetAgentId } = req.body;

      // Validate input
      if (!targetAgentId) {
        return res.status(400).json({ message: 'targetAgentId is required' });
      }

      // Check if lead exists
      const leadResult = await query('SELECT * FROM leads WHERE id = $1', [leadId]);
      if (!leadResult.rows[0]) {
        return res.status(404).json({ message: 'Lead not found' });
      }

      const lead = leadResult.rows[0];

      // Check if target agent exists
      const targetAgentResult = await query("SELECT id FROM users WHERE id = $1 AND role = 'agent'", [targetAgentId]);
      if (!targetAgentResult.rows[0]) {
        return res.status(404).json({ message: 'Target agent not found' });
      }

      // Check if current agent exists (optional, but good practice)
      const currentAgentResult = await query("SELECT id FROM users WHERE id = $1 AND role = 'agent'", [lead.agent_id]);
      if (!currentAgentResult.rows[0]) {
        return res.status(400).json({ message: 'Current agent not found' });
      }

      // Transfer the lead
      const updateResult = await query(
        'UPDATE leads SET agent_id = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
        [targetAgentId, leadId]
      );

      // Log the activity
      await logActivity({
        userId: req.user?.id as string,
        action: 'LEAD_TRANSFERRED',
        entityType: 'lead',
        entityId: leadId,
        changes: {
          fromAgentId: lead.agent_id,
          toAgentId: targetAgentId,
          clientName: lead.client_name,
          email: lead.email,
          phone: lead.phone
        }
      });

      res.json({ 
        success: true, 
        lead: updateResult.rows[0],
        message: `Lead transferred successfully from agent to ${targetAgentId}` 
      });
    } catch (error) {
      next(error);
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
