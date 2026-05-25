import { query } from '../utils/database';

export const attachmentsModel = {
  async create(data: { leadId: string; fileName: string; mimeType: string; url: string; size: number; uploadedBy?: string }) {
    const sql = `INSERT INTO attachments (lead_id, file_name, mime_type, url, size, uploaded_by) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`;
    const params = [data.leadId, data.fileName, data.mimeType, data.url, data.size, data.uploadedBy || null];
    const result = await query(sql, params);
    return result.rows[0];
  },

  async findByLeadId(leadId: string) {
    const result = await query('SELECT * FROM attachments WHERE lead_id = $1 ORDER BY created_at DESC', [leadId]);
    return result.rows;
  },

  async findById(id: string) {
    const result = await query('SELECT * FROM attachments WHERE id = $1', [id]);
    return result.rows[0];
  },

  async delete(id: string) {
    await query('DELETE FROM attachments WHERE id = $1', [id]);
  }
};
