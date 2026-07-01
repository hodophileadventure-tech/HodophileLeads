import type { PoolClient } from 'pg';
import type { DbTransactionClient } from '../utils/database';
import { getClient } from '../utils/database';

const parseAmount = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const normalized = Number(String(value).replace(/[^0-9.\-]/g, ''));
  if (Number.isNaN(normalized)) {
    return null;
  }

  return normalized;
};

const getObjectCandidates = (documentData: any): any[] => {
  const candidates = [documentData];
  if (documentData && typeof documentData.documentData === 'object' && documentData.documentData !== null) {
    candidates.push(documentData.documentData);
  }
  for (const key of ['quotation', 'quote', 'invoice', 'pdf', 'payload', 'data']) {
    if (documentData && typeof documentData[key] === 'object' && documentData[key] !== null) {
      candidates.push(documentData[key]);
    }
  }
  return candidates;
};

export const resolveQuotationSubtotal = (documentData: any): { subtotal: number | null; source: string | null } => {
  if (!documentData || typeof documentData !== 'object') {
    console.warn('[Quotation Pricing] Missing documentData while resolving subtotal.');
    return { subtotal: null, source: null };
  }

  const candidateObjects = getObjectCandidates(documentData);
  const directKeys = ['subtotal', 'total', 'totalDue', 'total_due', 'grandTotal', 'grand_total', 'netTotal', 'net_total', 'totalAmount', 'total_amount', 'amount'];

  for (const candidateObject of candidateObjects) {
    for (const key of directKeys) {
      const parsed = parseAmount(candidateObject?.[key]);
      if (parsed !== null) {
        return { subtotal: parsed, source: `documentData.${key}` };
      }
    }
  }

  console.warn('[Quotation Pricing] Unable to resolve subtotal from documentData.', {
    keys: Object.keys(documentData || {}),
    hasSubtotal: candidateObjects.some((candidateObject) => directKeys.some((key) => candidateObject?.[key] !== undefined && candidateObject?.[key] !== null && candidateObject?.[key] !== ''))
  });
  return { subtotal: null, source: null };
};

export const extractQuotationSubtotal = (documentData: any): number | null => resolveQuotationSubtotal(documentData).subtotal;

const updateLeadPricing = async (
  client: PoolClient | DbTransactionClient,
  leadId: string,
  subtotal: number,
  markAccepted: boolean
) => {
  const existingLeadResult = await client.query(
    `SELECT id, initial_price, latest_revised_price, actual_price FROM leads WHERE id = $1 FOR UPDATE`,
    [leadId]
  );

  if (!existingLeadResult.rows.length) {
    return null;
  }

  const existingLead = existingLeadResult.rows[0];
  const initialPrice = existingLead.initial_price ?? subtotal;
  const latestRevisedPrice = subtotal;
  const actualPrice = markAccepted ? subtotal : existingLead.actual_price ?? null;

  const updatedLeadResult = await client.query(
    `UPDATE leads
     SET initial_price = $2,
         latest_revised_price = $3,
         actual_price = $4,
         updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [leadId, initialPrice, latestRevisedPrice, actualPrice]
  );

  return updatedLeadResult.rows[0];
};

export const syncLeadQuotationPricing = async (
  leadId: string,
  documentData: any,
  options: { markAccepted?: boolean } = {},
  client?: PoolClient | DbTransactionClient
) => {
  const resolution = resolveQuotationSubtotal(documentData);
  if (resolution.subtotal === null) {
    return { subtotal: null, lead: null };
  }

  console.log('[Quotation Pricing] Resolved quotation subtotal', {
    leadId,
    subtotal: resolution.subtotal,
    source: resolution.source,
    markAccepted: Boolean(options.markAccepted)
  });

  if (client) {
    console.log('[Quotation Pricing] Lead update payload queued', {
      leadId,
      initialPriceMode: 'first quotation preserves existing value or sets subtotal',
      latestRevisedPrice: resolution.subtotal,
      actualPriceMode: Boolean(options.markAccepted) ? 'accepted subtotal' : 'preserve current actual price'
    });
    const lead = await updateLeadPricing(client, leadId, resolution.subtotal, Boolean(options.markAccepted));
    console.log('[Quotation Pricing] Lead update success response', { leadId, lead });
    return { subtotal: resolution.subtotal, lead };
  }

  const transactionClient = await getClient();
  try {
    await transactionClient.query('BEGIN');
    console.log('[Quotation Pricing] Lead update payload queued', {
      leadId,
      initialPriceMode: 'first quotation preserves existing value or sets subtotal',
      latestRevisedPrice: resolution.subtotal,
      actualPriceMode: Boolean(options.markAccepted) ? 'accepted subtotal' : 'preserve current actual price'
    });
    const lead = await updateLeadPricing(transactionClient, leadId, resolution.subtotal, Boolean(options.markAccepted));
    await transactionClient.query('COMMIT');
    console.log('[Quotation Pricing] Lead update success response', { leadId, lead });
    return { subtotal: resolution.subtotal, lead };
  } catch (error) {
    try {
      await transactionClient.query('ROLLBACK');
    } catch (_) {}
    throw error;
  } finally {
    transactionClient.release();
  }
};

export const setLeadActualPrice = async (
  leadId: string,
  actualPrice: number | null,
  client?: PoolClient | DbTransactionClient
) => {
  if (client) {
    console.log('[Quotation Pricing] Direct actual price update payload', { leadId, actualPrice });
    const updatedLeadResult = await client.query(
      `UPDATE leads
       SET actual_price = $2,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [leadId, actualPrice]
    );

    console.log('[Quotation Pricing] Direct actual price update success response', { leadId, lead: updatedLeadResult.rows[0] });

    return updatedLeadResult.rows[0];
  }

  const transactionClient = await getClient();
  try {
    await transactionClient.query('BEGIN');

    console.log('[Quotation Pricing] Direct actual price update payload', { leadId, actualPrice });

    const updatedLeadResult = await transactionClient.query(
      `UPDATE leads
       SET actual_price = $2,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [leadId, actualPrice]
    );

    await transactionClient.query('COMMIT');
    console.log('[Quotation Pricing] Direct actual price update success response', { leadId, lead: updatedLeadResult.rows[0] });
    return updatedLeadResult.rows[0];
  } catch (error) {
    try {
      await transactionClient.query('ROLLBACK');
    } catch (_) {}
    throw error;
  } finally {
    transactionClient.release();
  }
};