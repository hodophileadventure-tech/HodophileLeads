import { query } from '../utils/database';
import type { Notification } from '../types';

export const notificationsModel = {
  async create(data: Partial<Notification>) {
    const sql = `
      INSERT INTO notifications (user_id, lead_id, type, message, payload, is_read)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    const params = [data.userId, data.leadId, data.type, data.message, data.payload || {}, data.is_read || false];
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
  }
};

export default notificationsModel;
