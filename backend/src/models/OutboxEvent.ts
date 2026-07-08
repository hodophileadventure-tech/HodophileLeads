import { randomUUID } from 'crypto';
import { query } from '../utils/database';

export type OutboxEventStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface OutboxEvent {
  id: string;
  externalId?: string | null;
  eventType: string;
  payload: any;
  status: OutboxEventStatus;
  retryCount: number;
  lastError?: string | null;
  nextAttemptAt: string;
  createdAt: string;
  updatedAt: string;
}

export const outboxEventModel = {
  async create(event: { eventType: string; payload: any; externalId?: string | null; nextAttemptAt?: string }, client?: any) {
    const executor = client && typeof client.query === 'function' ? client.query.bind(client) : query;
    const sql = `
      INSERT INTO outbox_events (id, external_id, event_type, payload, status, retry_count, next_attempt_at, created_at, updated_at)
      VALUES ($1, $2, $3, $4, 'pending', 0, $5, NOW(), NOW())
      ON CONFLICT (external_id) DO UPDATE
        SET payload = EXCLUDED.payload,
            status = 'pending',
            retry_count = outbox_events.retry_count,
            last_error = NULL,
            next_attempt_at = EXCLUDED.next_attempt_at,
            updated_at = NOW()
      RETURNING *
    `;

    const nextAttemptAt = event.nextAttemptAt || new Date().toISOString();
    const params = [randomUUID(), event.externalId || null, event.eventType, event.payload, nextAttemptAt];
    const result = await executor(sql, params);
    return result.rows[0];
  },

  async reservePending(limit = 10) {
    const sql = `
      WITH next_events AS (
        SELECT id
        FROM outbox_events
        WHERE status = 'pending' AND next_attempt_at <= NOW()
        ORDER BY created_at ASC
        LIMIT $1
        FOR UPDATE SKIP LOCKED
      )
      UPDATE outbox_events
      SET status = 'processing', updated_at = NOW()
      WHERE id IN (SELECT id FROM next_events)
      RETURNING *
    `;

    const result = await query(sql, [limit]);
    return result.rows;
  },

  async markCompleted(id: string) {
    const sql = `
      UPDATE outbox_events
      SET status = 'completed', updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    const result = await query(sql, [id]);
    return result.rows[0];
  },

  async markFailed(id: string, errorMessage: string, nextAttemptAt: string, retryCount: number) {
    const status = retryCount >= Number(process.env.OUTBOX_MAX_RETRY ?? '5') ? 'failed' : 'pending';
    const sql = `
      UPDATE outbox_events
      SET status = $2,
          retry_count = $3,
          last_error = $4,
          next_attempt_at = $5,
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    const result = await query(sql, [id, status, retryCount, errorMessage, nextAttemptAt]);
    return result.rows[0];
  }
};
