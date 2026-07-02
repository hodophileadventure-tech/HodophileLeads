import type { DbTransactionClient } from '../utils/database';
import { query, getClient } from '../utils/database';

const getDateKey = (referenceDate: Date) => {
  const year = String(referenceDate.getFullYear()).slice(-2);
  const month = String(referenceDate.getMonth() + 1).padStart(2, '0');
  const day = String(referenceDate.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
};

const GLOBAL_COUNTER_KEY = 'global';
const GLOBAL_QUOTATION_LOCK_KEY = 'quotation-number-global';

const getSavedQuotationMaxSequenceSql = `
  SELECT COALESCE(
    MAX((RIGHT(COALESCE(quotation_number, document_data->>'quoteNumber'), 4))::int),
    1100
  ) AS max_sequence
  FROM quote_requests
  WHERE COALESCE(quotation_number, document_data->>'quoteNumber') ~ '\\d+$'
`;

const getDatabaseClient = async () => {
  const dbClient = await getClient();
  return dbClient as DbTransactionClient;
};

const allocateNextSequence = async (dbClient: DbTransactionClient) => {
  await dbClient.query('SELECT pg_advisory_xact_lock(hashtext($1))', [GLOBAL_QUOTATION_LOCK_KEY]);

  const savedMaxResult = await dbClient.query(getSavedQuotationMaxSequenceSql);
  const savedMax = Number(savedMaxResult.rows[0]?.max_sequence ?? 1100);

  const counterResult = await dbClient.query(
    `INSERT INTO quotation_counters (date_key, last_sequence, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (date_key)
     DO UPDATE SET
       last_sequence = GREATEST(quotation_counters.last_sequence, EXCLUDED.last_sequence),
       updated_at = NOW()
     RETURNING last_sequence`,
    [GLOBAL_COUNTER_KEY, savedMax + 1]
  );

  return Number(counterResult.rows[0].last_sequence);
};

export async function generateQuotationNumber(
  referenceDate: Date = new Date(),
  client?: DbTransactionClient
): Promise<string> {
  try {
    const datePrefix = getDateKey(referenceDate);

    const run = async (dbClient: DbTransactionClient) => {
      const lastSequence = await allocateNextSequence(dbClient);
      return `${datePrefix}${lastSequence}`;
    };

    if (client) {
      return await run(client);
    }

    const dbClient = await getDatabaseClient();
    try {
      await dbClient.query('BEGIN');
      const quotationNumber = await run(dbClient);
      await dbClient.query('COMMIT');
      return quotationNumber;
    } catch (error) {
      try {
        await dbClient.query('ROLLBACK');
      } catch (_) {}
      throw error;
    } finally {
      dbClient.release();
    }
  } catch (error) {
    console.error('Error generating quotation number:', error);
    throw new Error('Failed to generate quotation number');
  }
}

export async function peekNextQuotationNumber(referenceDate: Date = new Date()): Promise<string> {
  const datePrefix = getDateKey(referenceDate);
  const dbClient = await getDatabaseClient();
  try {
    const result = await dbClient.query(
      `WITH saved_max AS (
        ${getSavedQuotationMaxSequenceSql}
      )
      SELECT GREATEST(COALESCE((SELECT last_sequence FROM quotation_counters WHERE date_key = $1), 1100), (SELECT max_sequence FROM saved_max)) + 1 AS next_sequence`,
      [GLOBAL_COUNTER_KEY]
    );
    const nextSequence = Number(result.rows[0]?.next_sequence ?? 1101);
    return `${datePrefix}${nextSequence}`;
  } finally {
    dbClient.release();
  }
}
