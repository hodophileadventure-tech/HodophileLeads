import { query } from '../utils/database';
import type { FollowUp } from '../types';

export const followUpsModel = {
  async findAllByAssignee(assignedTo: string, status?: string) {
    let sql = 'SELECT * FROM follow_ups WHERE assigned_to = $1';
    const params: any[] = [assignedTo];

    if (status) {
      sql += ' AND status = $2';
      params.push(status);
    }

    sql += ' ORDER BY due_date ASC';
    const result = await query(sql, params);
    return result.rows;
  },

  async findAll(status?: string) {
    let sql = 'SELECT * FROM follow_ups';
    const params: any[] = [];

    if (status) {
      sql += ' WHERE status = $1';
      params.push(status);
    }

    sql += ' ORDER BY due_date ASC';
    const result = await query(sql, params);
    return result.rows;
  },

  async findByLead(leadId: string) {
    const result = await query('SELECT * FROM follow_ups WHERE lead_id = $1 ORDER BY due_date ASC', [leadId]);
    return result.rows;
  },

  async create(data: Partial<FollowUp>) {
    const sql = `
      INSERT INTO follow_ups (
        lead_id, type, title, description, due_date, status, priority, assigned_to, completed_at, canceled_reason, canceled_by, canceled_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `;

    const params = [
      data.leadId,
      (data as any).type || 'manual',
      data.title,
      data.description || '',
      data.dueDate,
      data.status || 'upcoming',
      data.priority || 'medium',
      data.assignedTo,
      (data as any).completedAt || null,
      (data as any).canceledReason || null,
      (data as any).canceledBy || null,
      (data as any).canceledAt || null
    ];

    const result = await query(sql, params);
    return result.rows[0];
  },

  async update(id: string, data: Partial<FollowUp>) {
    const sql = `
      UPDATE follow_ups
      SET type = COALESCE($2, type),
          title = COALESCE($3, title),
          description = COALESCE($4, description),
          due_date = COALESCE($5, due_date),
          status = COALESCE($6, status),
          priority = COALESCE($7, priority),
          completed_at = COALESCE($8, completed_at),
          canceled_reason = COALESCE($9, canceled_reason),
          canceled_by = COALESCE($10, canceled_by),
          canceled_at = COALESCE($11, canceled_at)
      WHERE id = $1
      RETURNING *
    `;

    const params = [
      id,
      (data as any).type,
      data.title,
      data.description,
      data.dueDate,
      data.status,
      data.priority,
      (data as any).completedAt,
      (data as any).canceledReason,
      (data as any).canceledBy,
      (data as any).canceledAt
    ];

    const result = await query(sql, params);
    return result.rows[0];
  },

  async delete(id: string) {
    const result = await query('DELETE FROM follow_ups WHERE id = $1 RETURNING *', [id]);
    return result.rows[0];
  },

  async markDone(id: string) {
    const result = await query(
      "UPDATE follow_ups SET status = 'completed', completed_at = NOW() WHERE id = $1 RETURNING *",
      [id]
    );
    return result.rows[0];
  },

  async cancel(id: string, data: { canceledReason?: string; canceledBy?: string }) {
    const result = await query(
      "UPDATE follow_ups SET status = 'canceled', canceled_reason = $2, canceled_by = $3, canceled_at = NOW() WHERE id = $1 RETURNING *",
      [id, data.canceledReason || '', data.canceledBy || null]
    );
    return result.rows[0];
  },

  async findOverdue() {
    const result = await query(
      "SELECT * FROM follow_ups WHERE status != 'completed' AND due_date < NOW() ORDER BY due_date ASC"
    );
    return result.rows;
  }
};
