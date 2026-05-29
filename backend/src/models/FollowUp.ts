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

  async findByLead(leadId: string) {
    const result = await query('SELECT * FROM follow_ups WHERE lead_id = $1 ORDER BY due_date ASC', [leadId]);
    return result.rows;
  },

  async create(data: Partial<FollowUp>) {
    const sql = `
      INSERT INTO follow_ups (
        lead_id, assigned_to, task_type, due_date, status, notes, priority, reminder_type, whatsapp_number, whatsapp_link, canceled_reason, canceled_by, canceled_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `;

    const phone = (data.whatsappNumber || '').replace(/[^0-9]/g, '');
    const waLink = phone ? `https://wa.me/${phone}` : '';

    const params = [
      data.leadId,
      data.assignedTo,
      data.title,
      data.dueDate,
      data.status || 'upcoming',
      data.description || '',
      data.priority || 'medium',
      data.reminderType || 'client_requested',
      data.whatsappNumber || '',
      data.whatsappLink || waLink,
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
      SET task_type = COALESCE($2, task_type),
          due_date = COALESCE($3, due_date),
          status = COALESCE($4, status),
          notes = COALESCE($5, notes),
          priority = COALESCE($6, priority),
          reminder_type = COALESCE($7, reminder_type),
          whatsapp_number = COALESCE($8, whatsapp_number),
          whatsapp_link = COALESCE($9, whatsapp_link),
          canceled_reason = COALESCE($10, canceled_reason),
          canceled_by = COALESCE($11, canceled_by),
          canceled_at = COALESCE($12, canceled_at),
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;

    const phone = (data.whatsappNumber || '').replace(/[^0-9]/g, '');
    const waLink = phone ? `https://wa.me/${phone}` : data.whatsappLink || '';
    const params = [
      id,
      data.title,
      data.dueDate,
      data.status,
      data.description,
      data.priority,
      data.reminderType,
      data.whatsappNumber,
      waLink,
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
      "UPDATE follow_ups SET status = 'completed', completed_at = NOW(), updated_at = NOW() WHERE id = $1 RETURNING *",
      [id]
    );
    return result.rows[0];
  },

  async cancel(id: string, data: { canceledReason?: string; canceledBy?: string }) {
    const result = await query(
      "UPDATE follow_ups SET status = 'canceled', canceled_reason = $2, canceled_by = $3, canceled_at = NOW(), updated_at = NOW() WHERE id = $1 RETURNING *",
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
