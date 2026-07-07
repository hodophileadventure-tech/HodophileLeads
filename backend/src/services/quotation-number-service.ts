import type { DbTransactionClient } from '../utils/database';
import { getClient } from '../utils/database';

const QUOTATION_NUMBER_LOCK_KEY = 'quotation-number-global';
const QUOTATION_NUMBER_START = 1100;

const getDatabaseClient = async () => {
  const dbClient = await getClient();
  return dbClient as DbTransactionClient;
};

const getLatestQuotationSequenceSql = `
  SELECT COALESCE(
    NULLIF(
      regexp_replace(
        regexp_replace(
          COALESCE(quotation_number, document_data->>'quoteNumber'),
          '^(?:\\d{6})+(\\d{4,})$',
          '\\1'
        ),
        '\\D',
        '',
        'g'
      ),
      ''
    )::bigint,
    0
  ) AS sequence_value
  FROM quote_requests
  WHERE COALESCE(quotation_number, document_data->>'quoteNumber') ~ '\\d'
  ORDER BY sequence_value DESC, created_at DESC
  LIMIT 1
`;

const formatDatePrefix = (date: Date) => {
  const year = String(date.getUTCFullYear()).slice(-2);
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}${month}${day}`;
};

const allocateNextQuotationSequence = async (dbClient: DbTransactionClient) => {
  await dbClient.query('SELECT pg_advisory_xact_lock(hashtext($1))', [QUOTATION_NUMBER_LOCK_KEY]);

  const latestResult = await dbClient.query(getLatestQuotationSequenceSql);
  const latestSequence = Number(latestResult.rows[0]?.sequence_value ?? QUOTATION_NUMBER_START);
  return Math.max(latestSequence, QUOTATION_NUMBER_START) + 1;
};

const allocateNextQuotationNumber = async (dbClient: DbTransactionClient, datePrefix: string) => {
  const nextSequence = await allocateNextQuotationSequence(dbClient);
  return `${datePrefix}${String(nextSequence)}`;
};

export async function generateQuotationNumber(date?: Date, client?: DbTransactionClient): Promise<string> {
  try {
    const referenceDate = date ?? new Date();
    const datePrefix = formatDatePrefix(referenceDate);
    const run = async (dbClient: DbTransactionClient) => allocateNextQuotationNumber(dbClient, datePrefix);

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

export async function peekNextQuotationNumber(date?: Date): Promise<string> {
  const referenceDate = date ?? new Date();
  const datePrefix = formatDatePrefix(referenceDate);
  const dbClient = await getDatabaseClient();
  try {
    const result = await dbClient.query(getLatestQuotationSequenceSql);
    const latestSequence = Number(result.rows[0]?.sequence_value ?? QUOTATION_NUMBER_START);
    return `${datePrefix}${String(Math.max(latestSequence, QUOTATION_NUMBER_START) + 1)}`;
  } finally {
    dbClient.release();
  }
}
