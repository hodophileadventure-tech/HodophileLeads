import { query } from '../utils/database';
import type { Notification } from '../types';

export const notificationsModel = {
  async create(data: {
    user_id?: string;
    userId?: string;
    lead_id?: string;
    leadId?: string;
    entity_type?: string;
    entity_id?: string;
    type: string;
    message: string;
    payload?: Record<string, any>;
    is_read?: boolean;
  }) {
    // Support both camelCase and snake_case
    const userId = data.user_id || data.userId;
    const leadId = data.lead_id || data.leadId;
    const entityType = data.entity_type;
    const entityId = data.entity_id;

    const sql = `
      INSERT INTO notifications (user_id, lead_id, entity_type, entity_id, type, message, payload, is_read)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;
    const params = [
      userId,
      leadId || null,
      entityType || null,
      entityId || null,
      data.type,
      data.message,
      data.payload ? JSON.stringify(data.payload) : null,
      data.is_read || false
    ];
    const res = await query(sql, params);
    return res.rows[0];
  },

  async listByUser(userId: string) {
    const res = await query('SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100', [userId]);
    return res.rows;
  },

  async markRead(id: string) {
    const res = await query('UPDATE notifications SET is_read = TRUE WHERE id = $1 RETURNING *', [id]);
    return res.rows[0];
  },

  async deleteByLead(leadId: string) {
    await query('DELETE FROM notifications WHERE lead_id = $1', [leadId]);
  }
};

export default notificationsModel;
