require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const parseAmount = (value) => {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const normalized = Number(String(value).replace(/[^0-9.\-]/g, ''));
  return Number.isNaN(normalized) ? null : normalized;
};

const extractFromRow = (row) => {
  if (!row || typeof row !== 'object') return null;

  const direct = [row.amount, row.subtotal, row.total, row.totalAmount, row.lineTotal];
  for (const value of direct) {
    const parsed = parseAmount(value);
    if (parsed !== null) return parsed;
  }

  const price = parseAmount(row.price ?? row.unitPrice ?? row.rate);
  const quantity = parseAmount(row.persons ?? row.qty ?? row.quantity ?? row.count);
  if (price !== null && quantity !== null) return price * quantity;

  return null;
};

const resolveSubtotal = (documentData) => {
  if (!documentData || typeof documentData !== 'object') return { subtotal: null, source: null };

  const objects = [documentData];
  for (const key of ['quotation', 'quote', 'invoice', 'pdf', 'payload', 'data']) {
    if (documentData[key] && typeof documentData[key] === 'object') {
      objects.push(documentData[key]);
    }
  }

  const directKeys = ['subtotal', 'totalDue', 'total_due', 'grandTotal', 'grand_total', 'netTotal', 'net_total', 'totalAmount', 'total_amount', 'total'];
  for (const object of objects) {
    for (const key of directKeys) {
      const parsed = parseAmount(object[key]);
      if (parsed !== null) return { subtotal: parsed, source: `documentData.${key}` };
    }
  }

  const arrayKeys = ['tableRows', 'items', 'lineItems', 'rows', 'services', 'charges'];
  for (const object of objects) {
    for (const key of arrayKeys) {
      if (!Array.isArray(object[key])) continue;
      const subtotal = object[key].reduce((sum, row) => sum + (extractFromRow(row) ?? 0), 0);
      if (subtotal > 0) return { subtotal, source: `documentData.${key}` };
    }
  }

  for (const object of objects) {
    const price = parseAmount(object.price ?? object.packagePrice ?? object.unitPrice);
    const quantity = parseAmount(object.persons ?? object.qty ?? object.quantity ?? object.count);
    if (price !== null && quantity !== null && price > 0 && quantity > 0) {
      return { subtotal: price * quantity, source: 'documentData.price×quantity' };
    }
  }

  return { subtotal: null, source: null };
};

async function main() {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT qr.id, qr.lead_id, qr.document_data, qr.created_at, l.client_name
       FROM quote_requests qr
       LEFT JOIN leads l ON l.id = qr.lead_id
       WHERE qr.request_type = 'quotation'
       ORDER BY qr.created_at ASC`
    );

    const legacyQuotes = [];
    for (const row of result.rows) {
      const resolution = resolveSubtotal(row.document_data);
      if (resolution.subtotal === null) {
        legacyQuotes.push({
          id: row.id,
          leadId: row.lead_id,
          clientName: row.client_name || null,
          createdAt: row.created_at,
          reason: 'No trusted subtotal found in document_data'
        });
      }
    }

    console.log(JSON.stringify({ count: legacyQuotes.length, legacyQuotes }, null, 2));
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error('Failed to report legacy quotations:', error.message);
  process.exit(1);
});