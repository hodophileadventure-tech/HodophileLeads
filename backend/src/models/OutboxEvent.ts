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

const mapOutboxRow = (row: any) => {
  if (!row) return row;

  return {
    id: row.id,
    externalId: row.external_id ?? row.externalId ?? null,
    eventType: row.event_type ?? row.eventType,
    payload: row.payload,
    status: row.status,
    retryCount: row.retry_count ?? row.retryCount ?? 0,
    lastError: row.last_error ?? row.lastError ?? null,
    nextAttemptAt: row.next_attempt_at ?? row.nextAttemptAt,
    createdAt: row.created_at ?? row.createdAt,
    updatedAt: row.updated_at ?? row.updatedAt,
  };
};

export const outboxEventModel = {
  async create(event: { eventType: string; payload: any; externalId?: string | null; nextAttemptAt?: string }, client?: any) {
    const executor = client && typeof client.query === 'function' ? client.query.bind(client) : query;
    const nextAttemptAt = event.nextAttemptAt || new Date().toISOString();

    if (event.externalId) {
      const existingResult = await executor(
        `SELECT id FROM outbox_events WHERE external_id = $1 LIMIT 1`,
        [event.externalId]
      );
      if (existingResult.rows.length) {
        const existingId = existingResult.rows[0].id;
        const updateSql = `
          UPDATE outbox_events
          SET payload = $1,
              status = 'pending',
              last_error = NULL,
              next_attempt_at = $2,
              updated_at = NOW()
          WHERE id = $3
          RETURNING *
        `;
        const updateResult = await executor(updateSql, [event.payload, nextAttemptAt, existingId]);
        return mapOutboxRow(updateResult.rows[0]);
      }
    }

    const insertSql = `
      INSERT INTO outbox_events (id, external_id, event_type, payload, status, retry_count, next_attempt_at, created_at, updated_at)
      VALUES ($1, $2, $3, $4, 'pending', 0, $5, NOW(), NOW())
      RETURNING *
    `;
    const params = [randomUUID(), event.externalId || null, event.eventType, event.payload, nextAttemptAt];
    const result = await executor(insertSql, params);
    return mapOutboxRow(result.rows[0]);
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
    return result.rows.map(mapOutboxRow);
  },

  async markCompleted(id: string) {
    const sql = `
      UPDATE outbox_events
      SET status = 'completed', updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    const result = await query(sql, [id]);
    return mapOutboxRow(result.rows[0]);
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
    return mapOutboxRow(result.rows[0]);
  }
};
