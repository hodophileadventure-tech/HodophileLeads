import type { DbTransactionClient } from '../utils/database';
import { query } from '../utils/database';

const getDateKey = (referenceDate: Date) => {
  const year = String(referenceDate.getFullYear()).slice(-2);
  const month = String(referenceDate.getMonth() + 1).padStart(2, '0');
  const day = String(referenceDate.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
};

export async function generateQuotationNumber(
  referenceDate: Date = new Date(),
  client?: DbTransactionClient
): Promise<string> {
  try {
    const datePrefix = getDateKey(referenceDate);

    // Thread-safe atomic increment using UPSERT pattern
    // This ensures that even with concurrent requests, each gets a unique number
    const sql = `WITH upserted AS (
      INSERT INTO quotation_counters (date_key, last_sequence, updated_at)
      VALUES ($1, 1101, NOW())
      ON CONFLICT (date_key)
      DO UPDATE SET last_sequence = quotation_counters.last_sequence + 1, updated_at = NOW()
      RETURNING last_sequence
    )
    SELECT last_sequence FROM upserted`;

    const result = client
      ? await client.query(sql, [datePrefix])
      : await query(sql, [datePrefix]);

    const lastSequence = result.rows[0].last_sequence;
    const quotationNumber = `${datePrefix}${lastSequence}`;
    
    return quotationNumber;
  } catch (error) {
    console.error('Error generating quotation number:', error);
    throw new Error('Failed to generate quotation number');
  }
}

export async function peekNextQuotationNumber(referenceDate: Date = new Date()): Promise<string> {
  const datePrefix = getDateKey(referenceDate);
  const result = await query(
    'SELECT last_sequence FROM quotation_counters WHERE date_key = $1',
    [datePrefix]
  );
  const nextSequence = result.rows[0]?.last_sequence ? Number(result.rows[0].last_sequence) + 1 : 1101;
  return `${datePrefix}${nextSequence}`;
}
