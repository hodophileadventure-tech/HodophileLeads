import { query } from '../utils/database';

export const screenCaptureModel = {
  async create(data: {
    requestId: string;
    agentId: string;
    requestedBy?: string | null;
    fileName: string;
    mimeType: string;
    url: string;
    size: number;
    expiresAt: string;
  }) {
    const sql = `
      INSERT INTO screen_captures (request_id, agent_id, requested_by, file_name, mime_type, url, size, expires_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;
    const params = [
      data.requestId,
      data.agentId,
      data.requestedBy || null,
      data.fileName,
      data.mimeType,
      data.url,
      data.size,
      data.expiresAt
    ];
    const result = await query(sql, params);
    return result.rows[0];
  },

  async findById(id: string) {
    const result = await query('SELECT * FROM screen_captures WHERE id = $1', [id]);
    return result.rows[0];
  },

  async listExpired() {
    const result = await query('SELECT * FROM screen_captures WHERE expires_at <= NOW() ORDER BY created_at ASC');
    return result.rows;
  },

  async delete(id: string) {
    await query('DELETE FROM screen_captures WHERE id = $1', [id]);
  }
};

export default screenCaptureModel;
