import type { DbTransactionClient } from '../utils/database';
import { query } from '../utils/database';

const getDateKey = (referenceDate: Date) => {
  const year = String(referenceDate.getFullYear()).slice(-2);
  const month = String(referenceDate.getMonth() + 1).padStart(2, '0');
  const day = String(referenceDate.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
};

const getSavedQuotationMaxSequenceSql = `
  SELECT COALESCE(
    MAX((regexp_replace(COALESCE(quotation_number, document_data->>'quoteNumber'), '^\\d{6}', ''))::int),
    1100
  ) AS max_sequence
  FROM quote_requests
  WHERE COALESCE(quotation_number, document_data->>'quoteNumber') ~ ('^' || $1 || '\\d+$')
`;

export async function generateQuotationNumber(
  referenceDate: Date = new Date(),
  client?: DbTransactionClient
): Promise<string> {
  try {
    const datePrefix = getDateKey(referenceDate);

    // Thread-safe atomic increment using the highest saved quotation as the floor.
    // This prevents new numbers from falling behind historical saved quotations.
    const sql = `WITH saved_max AS (
      ${getSavedQuotationMaxSequenceSql}
    ), upserted AS (
      INSERT INTO quotation_counters (date_key, last_sequence, updated_at)
      SELECT $1, max_sequence + 1, NOW()
      FROM saved_max
      ON CONFLICT (date_key)
      DO UPDATE SET
        last_sequence = GREATEST(quotation_counters.last_sequence + 1, EXCLUDED.last_sequence),
        updated_at = NOW()
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
    `WITH saved_max AS (
      ${getSavedQuotationMaxSequenceSql}
    )
    SELECT GREATEST(COALESCE((SELECT last_sequence FROM quotation_counters WHERE date_key = $1), 1100), (SELECT max_sequence FROM saved_max)) + 1 AS next_sequence`,
    [datePrefix]
  );
  const nextSequence = Number(result.rows[0]?.next_sequence ?? 1101);
  return `${datePrefix}${nextSequence}`;
}
