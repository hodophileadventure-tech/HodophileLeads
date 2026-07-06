import cron from 'node-cron';
import axios from 'axios';
import { outboxEventModel } from '../models/OutboxEvent';

const MAX_RETRY = Number(process.env.OUTBOX_MAX_RETRY ?? '5');
const BASE_RETRY_SECONDS = Number(process.env.OUTBOX_RETRY_BASE_SECONDS ?? '30');

const getEmployeePortalUrl = () => {
  const base = process.env.EMPLOYEE_PORTAL_URL || 'http://localhost:3000';
  return `${base.replace(/\/$/, '')}/api/sales/leads`;
};

const getAuthHeaders = () => {
  const token = process.env.EMPLOYEE_PORTAL_TOKEN;
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const getNextAttemptAt = (retryCount: number) => {
  const delaySeconds = Math.min(BASE_RETRY_SECONDS * Math.pow(2, retryCount), 3600);
  return new Date(Date.now() + delaySeconds * 1000).toISOString();
};

const sendEvent = async (event: any) => {
  const url = getEmployeePortalUrl();
  const headers = {
    'Content-Type': 'application/json',
    ...getAuthHeaders()
  };

  try {
    const response = await axios.post(url, event.payload, { headers, timeout: 10000 });
    if (![200, 201, 409].includes(response.status)) {
      throw new Error(`Unexpected response status: ${response.status}`);
    }
  } catch (error: any) {
    if (error.response && [200, 201, 409].includes(error.response.status)) {
      return;
    }
    throw error;
  }
};

export const processOutboxEvents = async () => {
  const events = await outboxEventModel.reservePending(10);
  if (!events || events.length === 0) {
    return;
  }

  for (const event of events) {
    try {
      await sendEvent(event);
      await outboxEventModel.markCompleted(event.id);
      console.log('[OutboxWorker] Sent event', event.id, event.eventType);
    } catch (error: any) {
      const retryCount = (event.retryCount || 0) + 1;
      const nextAttemptAt = getNextAttemptAt(retryCount);
      const message = error?.message || 'Unknown outbox delivery error';
      const updated = await outboxEventModel.markFailed(event.id, message, nextAttemptAt, retryCount);
      console.error('[OutboxWorker] Failed to send event', event.id, 'retryCount:', retryCount, 'error:', message, 'updated status:', updated.status);
    }
  }
};

export const startOutboxWorker = () => {
  cron.schedule('* * * * *', async () => {
    try {
      await processOutboxEvents();
    } catch (error: any) {
      console.error('[OutboxWorker] Worker failed', error?.message || error);
    }
  });
};
