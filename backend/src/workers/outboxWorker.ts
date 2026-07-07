import cron from 'node-cron';
import axios from 'axios';
import { outboxEventModel } from '../models/OutboxEvent';

const MAX_RETRY = Number(process.env.OUTBOX_MAX_RETRY ?? '5');
const BASE_RETRY_SECONDS = Number(process.env.OUTBOX_RETRY_BASE_SECONDS ?? '30');

const getEmployeePortalUrl = () => {
  const base = process.env.EMPLOYEE_PORTAL_URL || 'http://localhost:3000';
  return `${base.replace(/\/$/, '')}`;
};

const getAuthHeaders = () => {
  const token = process.env.EMPLOYEE_PORTAL_TOKEN;
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const getCommissionAuthHeaders = () => {
  const apiKey = process.env.INTERNAL_API_KEY;
  if (!apiKey) {
    console.warn('[OutboxWorker] INTERNAL_API_KEY not configured for commission delivery');
    return {};
  }
  return { Authorization: `ApiKey ${apiKey}` };
};

export const getNextAttemptAt = (retryCount: number) => {
  const delaySeconds = Math.min(BASE_RETRY_SECONDS * Math.pow(2, retryCount), 3600);
  return new Date(Date.now() + delaySeconds * 1000).toISOString();
};

const sendCommissionEvent = async (event: any) => {
  const url = `${getEmployeePortalUrl()}/api/external/commission`;
  const headers = {
    'Content-Type': 'application/json',
    ...getCommissionAuthHeaders()
  };

  console.log('[OutboxWorker] Sending commission event to Employee Portal:', {
    url,
    eventId: event.id,
    leadId: event.payload?.leadId,
    employeeId: event.payload?.employeeId,
    commission: event.payload?.commission,
  });

  try {
    const response = await axios.post(url, event.payload, { headers, timeout: 10000 });
    if (![200, 201].includes(response.status)) {
      throw new Error(`Unexpected response status: ${response.status}`);
    }
    console.log('[OutboxWorker] Commission event delivered successfully:', {
      eventId: event.id,
      status: response.status,
      leadId: event.payload?.leadId,
    });
  } catch (error: any) {
    if (error.response && [200, 201].includes(error.response.status)) {
      return;
    }
    console.error('[OutboxWorker] Commission event failure response:', {
      eventId: event.id,
      status: error.response?.status,
      responseData: error.response?.data,
      payload: event.payload,
    });
    throw error;
  }
};

const sendEvent = async (event: any) => {
  const url = `${getEmployeePortalUrl()}/api/sales/leads`;
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
      // Route commission events to the commission endpoint
      if (event.eventType === 'employee_portal_confirmed_lead') {
        console.log('[OutboxWorker] Processing commission event:', event.id);
        await sendCommissionEvent(event);
      } else {
        // Route other events to the original endpoint
        await sendEvent(event);
      }
      
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
