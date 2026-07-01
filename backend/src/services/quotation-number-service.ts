import type { DbTransactionClient } from '../utils/database';
import { query } from '../utils/database';

export async function generateQuotationNumber(
  referenceDate: Date = new Date(),
  client?: DbTransactionClient
): Promise<string> {
  try {
    // Format date as YYMMDD
    const year = String(referenceDate.getFullYear()).slice(-2);
    const month = String(referenceDate.getMonth() + 1).padStart(2, '0');
    const day = String(referenceDate.getDate()).padStart(2, '0');
    const datePrefix = `${year}${month}${day}`;

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
