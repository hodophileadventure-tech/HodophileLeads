const counters = new Map<string, number>();
const savedMax = new Map<string, number>();
let advisoryLockHeld = false;
let advisoryLockQueue: Array<() => void> = [];

const mockQuery = jest.fn(async function (text: string, params?: any[]) {
  const sql = String(text).replace(/\s+/g, ' ').trim().toLowerCase();
  const client = this as any;

  if (sql === 'begin') {
    client._reservedSequence = undefined;
    client._hasAdvisoryLock = false;
    return { rows: [], rowCount: 0 };
  }

  if (sql === 'commit' || sql === 'rollback') {
    if (client?._hasAdvisoryLock) {
      if (sql === 'commit' && client._reservedSequence != null) {
        counters.set('global', client._reservedSequence);
      }
      client._hasAdvisoryLock = false;
      advisoryLockHeld = false;
      const next = advisoryLockQueue.shift();
      if (next) next();
    }
    return { rows: [], rowCount: 0 };
  }

  if (sql.includes('pg_advisory_xact_lock')) {
    if (advisoryLockHeld) {
      await new Promise<void>((resolve) => advisoryLockQueue.push(resolve));
    }
    advisoryLockHeld = true;
    client._hasAdvisoryLock = true;
    const currentSequence = counters.get('global') ?? 1100;
    const savedSequence = savedMax.get('global') ?? 1100;
    client._reservedSequence = Math.max(currentSequence, savedSequence) + 1;
    return { rows: [], rowCount: 0 };
  }

  if (sql.includes('regexp_replace') && sql.includes("coalesce(quotation_number, document_data->>'quotenumber')")) {
    const currentSequence = counters.get('global') ?? 1100;
    const savedSequence = savedMax.get('global') ?? 1100;
    return {
      rows: [{ sequence_value: Math.max(currentSequence, savedSequence) }],
      rowCount: 1
    };
  }

  return { rows: [], rowCount: 0 };
});

const mockGetClient = jest.fn(async () => ({
  query: mockQuery,
  release: jest.fn()
}));

jest.mock('../src/utils/database', () => ({
  query: mockQuery,
  getClient: mockGetClient
}));

import { generateQuotationNumber, peekNextQuotationNumber } from '../src/services/quotation-number-service';

describe('quotation number service', () => {
  beforeEach(() => {
    counters.clear();
    savedMax.clear();
    mockQuery.mockClear();
    mockGetClient.mockClear();
  });

  test('generates 100 unique sequential numbers in parallel', async () => {
    const referenceDate = new Date('2025-07-02T00:00:00Z');

    const results = await Promise.all(
      Array.from({ length: 100 }, () => generateQuotationNumber(referenceDate))
    );

    const sortedResults = [...results].sort();
    const expectedResults = Array.from({ length: 100 }, (_, index) => `250702${String(1101 + index)}`);

    expect(new Set(results).size).toBe(100);
    expect(sortedResults).toEqual(expectedResults);
    expect(sortedResults[0]).toBe('2507021101');
    expect(sortedResults[sortedResults.length - 1]).toBe('2507021200');
  });

  test('generateQuotationNumber seeds from the highest saved quotation when the counter is behind', async () => {
    const referenceDate = new Date('2025-07-02T00:00:00Z');

    savedMax.set('global', 1102);
    counters.set('global', 1100);

    expect(await generateQuotationNumber(referenceDate)).toBe('2507021103');
    expect(await generateQuotationNumber(referenceDate)).toBe('2507021104');
  });
});
