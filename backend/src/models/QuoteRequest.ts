import { query } from '../utils/database';
import type { QuoteRequest } from '../types';

const mapQuoteRequestRow = (row: any) => {
  if (!row) return row;

  return {
    id: row.id,
    leadId: row.lead_id || row.leadId,
    requestedBy: row.requested_by || row.requestedBy,
    requestType: row.request_type || row.requestType,
    status: row.status,
    documentData: row.document_data || row.documentData || null,
    resolvedBy: row.resolved_by || row.resolvedBy || null,
    resolvedAt: row.resolved_at || row.resolvedAt || null,
    approvedBy: row.approved_by || row.approvedBy || null,
    approvedAt: row.approved_at || row.approvedAt || null,
    reRequestNotes: row.re_request_notes || row.reRequestNotes || null,
    parentRequestId: row.parent_request_id || row.parentRequestId || null,
    createdAt: row.created_at || row.createdAt,
    updatedAt: row.updated_at || row.updatedAt,
    requestedByName: row.requested_by_name || row.requestedByName || null,
    leadClientName: row.lead_client_name || row.leadClientName || null,
    leadPhone: row.lead_phone || row.leadPhone || null,
    leadDestination: row.lead_destination || row.leadDestination || null,
    leadAgentRemarks: row.lead_agent_remarks || row.leadAgentRemarks || null,
    leadIslamabadStay: row.lead_islamabad_stay || row.leadIslamabadStay || null
  } as QuoteRequest;
};

export const quoteRequestsModel = {
  async create(data: Partial<QuoteRequest>) {
    const sql = `
      INSERT INTO quote_requests (
        lead_id,
        requested_by,
        request_type,
        status,
        document_data,
        resolved_by,
        resolved_at,
        approved_by,
        approved_at,
        re_request_notes,
        parent_request_id,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
      RETURNING *
    `;
    const params = [
      data.leadId,
      data.requestedBy,
      data.requestType,
      data.status || 'requested',
      data.documentData || null,
      data.resolvedBy || null,
      data.resolvedAt || null,
      data.approvedBy || null,
      data.approvedAt || null,
      data.reRequestNotes || null,
      data.parentRequestId || null
    ];
    const res = await query(sql, params);
    return mapQuoteRequestRow(res.rows[0]);
  },

  async findById(id: string) {
    const res = await query(`
      SELECT qr.*, u.name AS requested_by_name, l.client_name AS lead_client_name, l.phone AS lead_phone, l.destination AS lead_destination,
             l.agent_remarks AS lead_agent_remarks, l.islamabad_stay AS lead_islamabad_stay
      FROM quote_requests qr
      LEFT JOIN users u ON u.id = qr.requested_by
      LEFT JOIN leads l ON l.id = qr.lead_id
      WHERE qr.id = $1
    `, [id]);
    return mapQuoteRequestRow(res.rows[0]);
  },

  async findPending() {
    const res = await query(`
      SELECT qr.*, u.name AS requested_by_name, l.client_name AS lead_client_name, l.phone AS lead_phone, l.destination AS lead_destination,
             l.agent_remarks AS lead_agent_remarks, l.islamabad_stay AS lead_islamabad_stay
      FROM quote_requests qr
      LEFT JOIN users u ON u.id = qr.requested_by
      LEFT JOIN leads l ON l.id = qr.lead_id
      WHERE qr.status IN ('requested', 'saved')
      ORDER BY qr.created_at DESC
    `);
    return res.rows.map(mapQuoteRequestRow);
  },

  async findByLead(leadId: string) {
    const res = await query('SELECT * FROM quote_requests WHERE lead_id = $1 ORDER BY created_at DESC', [leadId]);
    return res.rows.map(mapQuoteRequestRow);
  },

  async findAccessibleByUser(userId: string, role: string) {
    if (role === 'admin' || role === 'manager') {
      const res = await query(`
        SELECT qr.*, u.name AS requested_by_name, l.client_name AS lead_client_name, l.phone AS lead_phone, l.destination AS lead_destination,
               l.agent_remarks AS lead_agent_remarks, l.islamabad_stay AS lead_islamabad_stay
        FROM quote_requests qr
        LEFT JOIN users u ON u.id = qr.requested_by
        LEFT JOIN leads l ON l.id = qr.lead_id
        ORDER BY qr.created_at DESC
      `);
      return res.rows.map(mapQuoteRequestRow);
    }

    const res = await query(`
      SELECT qr.*, u.name AS requested_by_name, l.client_name AS lead_client_name, l.phone AS lead_phone, l.destination AS lead_destination
      FROM quote_requests qr
      INNER JOIN leads l ON l.id = qr.lead_id
      LEFT JOIN users u ON u.id = qr.requested_by
      WHERE l.agent_id = $1 AND qr.status IN ('requested', 'saved', 'approved')
      ORDER BY qr.created_at DESC
    `, [userId]);
    return res.rows.map(mapQuoteRequestRow);
  },

  async update(id: string, data: Partial<QuoteRequest>) {
    const fields: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (data.status) {
      fields.push(`status = $${paramIndex++}`);
      params.push(data.status);
    }
    if (data.documentData !== undefined) {
      fields.push(`document_data = $${paramIndex++}`);
      params.push(data.documentData);
    }
    if (data.resolvedBy !== undefined) {
      fields.push(`resolved_by = $${paramIndex++}`);
      params.push(data.resolvedBy);
    }
    if (data.resolvedAt !== undefined) {
      fields.push(`resolved_at = $${paramIndex++}`);
      params.push(data.resolvedAt);
    }
    if (data.approvedBy !== undefined) {
      fields.push(`approved_by = $${paramIndex++}`);
      params.push(data.approvedBy);
    }
    if (data.approvedAt !== undefined) {
      fields.push(`approved_at = $${paramIndex++}`);
      params.push(data.approvedAt);
    }
    if (data.reRequestNotes !== undefined) {
      fields.push(`re_request_notes = $${paramIndex++}`);
      params.push(data.reRequestNotes);
    }
    if (data.parentRequestId !== undefined) {
      fields.push(`parent_request_id = $${paramIndex++}`);
      params.push(data.parentRequestId);
    }

    if (fields.length === 0) {
      const existing = await this.findById(id);
      return existing;
    }

    fields.push(`updated_at = NOW()`);
    const sql = `UPDATE quote_requests SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
    params.push(id);

    const res = await query(sql, params);
    return mapQuoteRequestRow(res.rows[0]);
  },

  async delete(id: string) {
    const res = await query('DELETE FROM quote_requests WHERE id = $1 RETURNING *', [id]);
    return mapQuoteRequestRow(res.rows[0]);
  }
};
