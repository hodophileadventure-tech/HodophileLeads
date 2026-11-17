import cron from 'node-cron';
import { metaLeadWebhookEventModel } from '../models/MetaLeadWebhookEvent';
import {
  fetchMetaLeadById,
  importMetaLead,
  isRetryableMetaLeadError,
} from '../services/meta-lead-service';

const BATCH_SIZE = 10;
const MAX_ATTEMPTS = 8;
const BASE_RETRY_SECONDS = 30;
const MAX_RETRY_SECONDS = 3600;

export const getMetaLeadRetryDelayMs = (retryCount: number) => {
  const exponent = Math.max(0, retryCount - 1);
  return Math.min(BASE_RETRY_SECONDS * 2 ** exponent, MAX_RETRY_SECONDS) * 1000;
};

export const processMetaLeadEvents = async () => {
  const events = await metaLeadWebhookEventModel.reservePending(BATCH_SIZE);
  if (events.length > 0) {
    console.info(`[Meta Lead Worker] Processing ${events.length} queued event(s)`);
  }

  for (const event of events) {
    try {
      let payload = event.leadPayload;
      if (!payload) {
        payload = await fetchMetaLeadById(event.metaLeadId);
        await metaLeadWebhookEventModel.saveLeadPayload(event.metaLeadId, payload);
      }

      const result = await importMetaLead(
        event.metaLeadId,
        event.pageId,
        event.formId || undefined,
        event.platform || undefined,
        payload
      );
      await metaLeadWebhookEventModel.markCompleted(event.metaLeadId);

      if (result.duplicate) {
        console.info(`[Meta Lead Worker] Lead ${event.metaLeadId} was already imported`);
      } else {
        console.info(`[Meta Lead Worker] Imported lead ${event.metaLeadId} as ${result.leadId}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown import error';
      const retryable = isRetryableMetaLeadError(error);
      try {
        if (retryable && event.retryCount < MAX_ATTEMPTS) {
          const nextAttemptAt = new Date(Date.now() + getMetaLeadRetryDelayMs(event.retryCount)).toISOString();
          await metaLeadWebhookEventModel.scheduleRetry(event.metaLeadId, message, nextAttemptAt);
          console.warn(`[Meta Lead Worker] Retry scheduled for ${event.metaLeadId}: ${message}`);
        } else {
          await metaLeadWebhookEventModel.markFailed(event.metaLeadId, message);
          console.error(`[Meta Lead Worker] Permanently failed ${event.metaLeadId}: ${message}`);
        }
      } catch (queueError) {
        const queueMessage = queueError instanceof Error ? queueError.message : queueError;
        console.error(`[Meta Lead Worker] Could not update event ${event.metaLeadId}:`, queueMessage);
      }
    }
  }
};

const runMetaLeadWorker = async () => {
  try {
    await processMetaLeadEvents();
  } catch (error) {
    const message = error instanceof Error ? error.message : error;
    console.error('[Meta Lead Worker] Worker failed', message);
  }
};

export const startMetaLeadWorker = () => {
  cron.schedule('* * * * *', runMetaLeadWorker);
  console.info('[Meta Lead Worker] Started; polling every minute');
  void runMetaLeadWorker();
};
