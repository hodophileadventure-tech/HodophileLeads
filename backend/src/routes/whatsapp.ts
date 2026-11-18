import { createHmac, randomUUID, timingSafeEqual } from 'crypto';
import axios from 'axios';
import express, { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { getClient } from '../utils/database';
import { sendToUser } from '../utils/wsServer';

export const whatsappRouter = Router();

type AuthenticatedRequest = Request & {
  user?: {
    id: string;
    role: string;
  };
};

const constantTimeEquals = (left: string, right: string) => {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
};

const normalizePhone = (value: string) => {
  let digits = String(value || '').replace(/\D/g, '');
  if (digits.startsWith('0') && digits.length === 11) digits = `92${digits.slice(1)}`;
  if (digits.length === 10) digits = `92${digits}`;
  return digits;
};

const findLeadByPhone = async (phone: string) => {
  const client = await getClient();
  try {
    const result = await client.query(
      `SELECT id, phone, agent_id
       FROM leads
       WHERE regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g') = $1
          OR regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g') = $2
       LIMIT 1`,
      [phone, `0${phone.slice(-10)}`]
    );
    return result.rows[0] || null;
  } finally {
    client.release();
  }
};

whatsappRouter.get('/webhook', (req: Request, res: Response) => {
  const verifyToken = process.env.WA_WEBHOOK_VERIFY_TOKEN;
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (verifyToken && mode === 'subscribe' && typeof token === 'string' &&
      constantTimeEquals(token, verifyToken)) {
    res.set('Content-Type', 'text/plain');
    return res.status(200).send(typeof challenge === 'string' ? challenge : '');
  }
  return res.sendStatus(403);
});

whatsappRouter.post('/webhook', express.raw({ type: 'application/json', limit: '1mb' }), async (req: Request, res: Response) => {
  const appSecret = process.env.META_APP_SECRET;
  if (!appSecret) return res.status(503).json({ message: 'WhatsApp webhook is not configured' });
  if (!Buffer.isBuffer(req.body)) return res.status(400).json({ message: 'Expected a JSON request body' });

  const signature = req.header('x-hub-signature-256');
  const expected = `sha256=${createHmac('sha256', appSecret).update(req.body).digest('hex')}`;
  if (!signature || !constantTimeEquals(signature, expected)) return res.sendStatus(401);

  let payload: any;
  try {
    payload = JSON.parse(req.body.toString('utf8'));
  } catch {
    return res.status(400).json({ message: 'Invalid JSON payload' });
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');

    for (const entry of payload.entry || []) {
      for (const change of entry.changes || []) {
        const value = change.value || {};
        for (const whatsappMessage of value.messages || []) {
          const phone = normalizePhone(whatsappMessage.from);
          const lead = await findLeadByPhone(phone);
          if (!lead) {
            console.warn(`[WhatsApp webhook] No CRM lead matches ${phone}`);
            continue;
          }

          const conversation = await client.query(
            `INSERT INTO whatsapp_conversations (
               id, lead_id, phone_number, wa_phone_number_id, last_message_at, updated_at
             ) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
             ON CONFLICT (lead_id) DO UPDATE SET
               phone_number = EXCLUDED.phone_number,
               wa_phone_number_id = EXCLUDED.wa_phone_number_id,
               unread_count = whatsapp_conversations.unread_count + 1,
               last_message_at = CURRENT_TIMESTAMP,
               updated_at = CURRENT_TIMESTAMP
             RETURNING id`,
            [randomUUID(), lead.id, phone, value.metadata?.phone_number_id || null]
          );
          const conversationId = conversation.rows[0].id;
          const text = whatsappMessage.text?.body ||
            (whatsappMessage.button?.text) ||
            (whatsappMessage.interactive?.button_reply?.title) ||
            null;
          await client.query(
            `INSERT INTO whatsapp_messages (
               id, conversation_id, lead_id, wa_message_id, direction,
               message_type, message_text, status, timestamp, metadata
             ) VALUES ($1, $2, $3, $4, 'inbound', $5, $6, 'received', $7, $8)
             ON CONFLICT (wa_message_id) DO NOTHING`,
            [
              randomUUID(),
              conversationId,
              lead.id,
              whatsappMessage.id,
              whatsappMessage.type || 'text',
              text,
              whatsappMessage.timestamp
                ? new Date(Number(whatsappMessage.timestamp) * 1000)
                : new Date(),
              JSON.stringify(whatsappMessage),
            ]
          );
          sendToUser(String(lead.agent_id), 'whatsapp-message', {
            leadId: lead.id,
            conversationId,
            direction: 'inbound',
            messageType: whatsappMessage.type || 'text',
            text,
            timestamp: new Date().toISOString(),
          });
        }

        for (const status of value.statuses || []) {
          await client.query(
            `UPDATE whatsapp_messages
             SET status = $2, metadata = COALESCE(metadata, '{}'::jsonb) || $3::jsonb
             WHERE wa_message_id = $1`,
            [
              status.id,
              status.status,
              JSON.stringify({ status, errors: status.errors || [] }),
            ]
          );
        }
      }
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[WhatsApp webhook] Processing failed:', error);
    return res.status(500).json({ message: 'Unable to process WhatsApp webhook' });
  } finally {
    client.release();
  }
  return res.sendStatus(200);
});

whatsappRouter.use(express.json());
whatsappRouter.use(authMiddleware);

whatsappRouter.get('/conversations/:leadId/messages', async (req: AuthenticatedRequest, res: Response) => {
  const client = await getClient();
  try {
    const lead = await client.query(
      `SELECT id, phone, agent_id FROM leads WHERE id = $1`,
      [req.params.leadId]
    );
    if (lead.rowCount === 0) return res.status(404).json({ message: 'Lead not found' });
    if (req.user?.role !== 'admin' && req.user?.role !== 'manager' &&
        req.user?.role !== 'qa' && String(req.user?.id) !== String(lead.rows[0].agent_id)) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const conversation = await client.query(
      `SELECT id FROM whatsapp_conversations WHERE lead_id = $1`,
      [req.params.leadId]
    );
    if (conversation.rowCount === 0) return res.json({ conversation: null, messages: [] });

    await client.query(
      `UPDATE whatsapp_conversations SET unread_count = 0, updated_at = CURRENT_TIMESTAMP WHERE lead_id = $1`,
      [req.params.leadId]
    );
    const messages = await client.query(
      `SELECT id, wa_message_id, direction, message_type, message_text,
              media_id, media_url, status, sender_user_id, timestamp
       FROM whatsapp_messages
       WHERE conversation_id = $1
       ORDER BY timestamp ASC`,
      [conversation.rows[0].id]
    );
    return res.json({ conversation: conversation.rows[0], messages: messages.rows });
  } finally {
    client.release();
  }
});

whatsappRouter.post('/conversations/:leadId/messages', async (req: AuthenticatedRequest, res: Response) => {
  const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
  if (!text) return res.status(400).json({ message: 'Message text is required' });

  const accessToken = process.env.WA_ACCESS_TOKEN;
  const phoneNumberId = process.env.WA_PHONE_NUMBER_ID;
  const apiVersion = process.env.META_GRAPH_API_VERSION || 'v27.0';
  if (!accessToken || !phoneNumberId) {
    return res.status(503).json({ message: 'WhatsApp Cloud API is not configured' });
  }

  const client = await getClient();
  try {
    const leadResult = await client.query(
      `SELECT id, phone, agent_id FROM leads WHERE id = $1`,
      [req.params.leadId]
    );
    if (leadResult.rowCount === 0) return res.status(404).json({ message: 'Lead not found' });
    const lead = leadResult.rows[0];
    if (req.user?.role !== 'admin' && req.user?.role !== 'manager' &&
        req.user?.role !== 'qa' && String(req.user?.id) !== String(lead.agent_id)) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const to = normalizePhone(lead.phone);
    const response = await axios.post(
      `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`,
      {
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: text },
      },
      {
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        timeout: 10000,
      }
    );
    const waMessageId = response.data.messages?.[0]?.id || null;

    await client.query('BEGIN');
    const conversation = await client.query(
      `INSERT INTO whatsapp_conversations (
         id, lead_id, phone_number, wa_phone_number_id, last_message_at, updated_at
       ) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT (lead_id) DO UPDATE SET
         phone_number = EXCLUDED.phone_number,
         wa_phone_number_id = EXCLUDED.wa_phone_number_id,
         last_message_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP
       RETURNING id`,
      [randomUUID(), lead.id, to, phoneNumberId]
    );
    await client.query(
      `INSERT INTO whatsapp_messages (
         id, conversation_id, lead_id, wa_message_id, direction,
         message_type, message_text, status, sender_user_id, timestamp
       ) VALUES ($1, $2, $3, $4, 'outbound', 'text', $5, 'sent', $6, CURRENT_TIMESTAMP)`,
      [randomUUID(), conversation.rows[0].id, lead.id, waMessageId, text, req.user?.id]
    );
    await client.query('COMMIT');

    sendToUser(String(lead.agent_id), 'whatsapp-message', {
      leadId: lead.id,
      conversationId: conversation.rows[0].id,
      direction: 'outbound',
      messageType: 'text',
      text,
      timestamp: new Date().toISOString(),
    });
    return res.status(201).json({ success: true, waMessageId });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    const message = axios.isAxiosError(error)
      ? error.response?.data?.error?.message || 'WhatsApp API request failed'
      : error instanceof Error ? error.message : 'WhatsApp API request failed';
    console.error('[WhatsApp] Send failed:', message);
    return res.status(502).json({ message });
  } finally {
    client.release();
  }
});
