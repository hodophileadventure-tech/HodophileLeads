import { query } from './database';

export interface LogActivityPayload {
  userId: string;
  entityType: string;
  entityId: string;
  action: string;
  changes?: Record<string, any>;
}

export const logActivity = async (payload: LogActivityPayload) => {
  if (!payload.userId || !payload.entityType || !payload.entityId || !payload.action) {
    throw new Error('logActivity requires userId, entityType, entityId, and action');
  }

  const sql = `
    INSERT INTO audit_logs (entity_type, entity_id, action, changes, user_id, created_at)
    VALUES ($1, $2, $3, $4, $5, NOW())
    RETURNING *
  `;

  const params = [payload.entityType, payload.entityId, payload.action, payload.changes || {}, payload.userId];
  const result = await query(sql, params);
  return result.rows[0];
};
