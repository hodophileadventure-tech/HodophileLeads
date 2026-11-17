import { createHmac, timingSafeEqual } from 'crypto';
import express, { Router, Request, Response } from 'express';
import { importMetaLead } from '../services/meta-lead-service';

export const metaWebhooksRouter = Router();

const constantTimeEquals = (left: string, right: string) => {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
};

metaWebhooksRouter.get('/webhook', (req: Request, res: Response) => {
  const verifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN;
  if (!verifyToken) return res.status(503).send('Meta webhook is not configured');

  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && typeof token === 'string' && constantTimeEquals(token, verifyToken)) {
    return res.status(200).send(typeof challenge === 'string' ? challenge : '');
  }
  return res.sendStatus(403);
});

metaWebhooksRouter.post('/webhook', express.raw({ type: 'application/json', limit: '1mb' }), async (req: Request, res: Response) => {
  const appSecret = process.env.META_APP_SECRET;
  if (!appSecret) return res.status(503).json({ message: 'Meta webhook is not configured' });
  if (!Buffer.isBuffer(req.body)) return res.status(400).json({ message: 'Expected a JSON request body' });

  const signature = req.header('x-hub-signature-256');
  const expected = `sha256=${createHmac('sha256', appSecret).update(req.body).digest('hex')}`;
  if (!signature || !constantTimeEquals(signature, expected)) {
    return res.sendStatus(401);
  }

  let payload: any;
  try {
    payload = JSON.parse(req.body.toString('utf8'));
  } catch {
    return res.status(400).json({ message: 'Invalid JSON payload' });
  }

  if (payload.object !== 'page' || !Array.isArray(payload.entry)) {
    return res.sendStatus(200);
  }

  const configuredPageId = process.env.META_PAGE_ID;
  for (const entry of payload.entry) {
    if (configuredPageId && String(entry.id) !== configuredPageId) {
      console.warn('[Meta webhook] Ignoring event for an unconfigured page');
      continue;
    }
    for (const change of entry.changes || []) {
      if (change.field !== 'leadgen') continue;
      const value = change.value || {};
      if (!value.leadgen_id || !value.page_id) {
        console.error('[Meta webhook] Lead event is missing its lead or page ID');
        continue;
      }
      try {
        const result = await importMetaLead(
          String(value.leadgen_id),
          String(value.page_id),
          value.form_id ? String(value.form_id) : undefined,
          value.platform ? String(value.platform) : undefined
        );
        if (result.duplicate) {
          console.info(`[Meta webhook] Lead ${value.leadgen_id} was already imported`);
        } else {
          console.info(`[Meta webhook] Imported lead ${value.leadgen_id} as ${result.leadId}`);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown import error';
        console.error(`[Meta webhook] Failed to import lead ${value.leadgen_id}: ${message}`);
        return res.status(500).json({ message: 'Unable to import Meta lead; Meta may retry the webhook' });
      }
    }
  }

  return res.sendStatus(200);
});
