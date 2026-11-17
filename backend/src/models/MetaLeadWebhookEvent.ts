import { query } from '../utils/database';
import type { MetaLead } from '../services/meta-lead-service';

export type MetaLeadWebhookEvent = {
  metaLeadId: string;
  pageId: string;
  formId: string | null;
  platform: string | null;
  leadPayload: MetaLead | null;
  retryCount: number;
};

const mapEvent = (row: any): MetaLeadWebhookEvent => ({
  metaLeadId: row.meta_lead_id,
  pageId: row.page_id,
  formId: row.form_id,
  platform: row.platform,
  leadPayload: row.lead_payload,
  retryCount: Number(row.retry_count),
});

const updateEvent = async (sql: string, params: unknown[], metaLeadId: string, action: string) => {
  const result = await query(sql, params);
  if (result.rows.length === 0) {
    throw new Error(`Meta lead event ${metaLeadId} could not be ${action}`);
  }
};

export const metaLeadWebhookEventModel = {
  async enqueue(event: Omit<MetaLeadWebhookEvent, 'leadPayload' | 'retryCount'>) {
    const result = await query(
      `INSERT INTO meta_lead_webhook_events (meta_lead_id, page_id, form_id, platform)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (meta_lead_id) DO NOTHING
       RETURNING meta_lead_id`,
      [event.metaLeadId, event.pageId, event.formId, event.platform]
    );
    return result.rows.length > 0;
  },

  async reservePending(limit: number): Promise<MetaLeadWebhookEvent[]> {
    const result = await query(
      `WITH candidates AS (
         SELECT meta_lead_id
         FROM meta_lead_webhook_events
         WHERE (status = 'pending' AND next_attempt_at <= CURRENT_TIMESTAMP)
            OR (status = 'processing' AND updated_at < CURRENT_TIMESTAMP - INTERVAL '10 minutes')
         ORDER BY created_at
         LIMIT $1
         FOR UPDATE SKIP LOCKED
       )
       UPDATE meta_lead_webhook_events event
       SET status = 'processing',
           retry_count = event.retry_count + 1,
           updated_at = CURRENT_TIMESTAMP
       FROM candidates
       WHERE event.meta_lead_id = candidates.meta_lead_id
       RETURNING event.*`,
      [limit]
    );
    return result.rows.map(mapEvent);
  },

  async saveLeadPayload(metaLeadId: string, leadPayload: MetaLead) {
    await updateEvent(
      `UPDATE meta_lead_webhook_events
       SET lead_payload = $2::jsonb, updated_at = CURRENT_TIMESTAMP
       WHERE meta_lead_id = $1 AND status = 'processing'
       RETURNING meta_lead_id`,
      [metaLeadId, JSON.stringify(leadPayload)],
      metaLeadId,
      'save the fetched lead data'
    );
  },

  async markCompleted(metaLeadId: string) {
    await updateEvent(
      `UPDATE meta_lead_webhook_events
       SET status = 'completed',
           lead_payload = NULL,
           last_error = NULL,
           processed_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE meta_lead_id = $1
       RETURNING meta_lead_id`,
      [metaLeadId],
      metaLeadId,
      'mark it completed'
    );
  },

  async scheduleRetry(metaLeadId: string, error: string, nextAttemptAt: string) {
    await updateEvent(
      `UPDATE meta_lead_webhook_events
       SET status = 'pending',
           last_error = $2,
           next_attempt_at = $3,
           updated_at = CURRENT_TIMESTAMP
       WHERE meta_lead_id = $1
       RETURNING meta_lead_id`,
      [metaLeadId, error, nextAttemptAt],
      metaLeadId,
      'schedule a retry for'
    );
  },

  async markFailed(metaLeadId: string, error: string) {
    await updateEvent(
      `UPDATE meta_lead_webhook_events
       SET status = 'failed',
           last_error = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE meta_lead_id = $1
       RETURNING meta_lead_id`,
      [metaLeadId, error],
      metaLeadId,
      'mark it failed'
    );
  },
};
