const counters = new Map<string, number>();

jest.mock('../src/utils/database', () => ({
  query: jest.fn(async (text: string, params?: any[]) => {
    const sql = String(text).replace(/\s+/g, ' ').trim().toLowerCase();
    const dateKey = params?.[0];

    if (sql.includes('select last_sequence from quotation_counters')) {
      const lastSequence = counters.get(dateKey);
      return {
        rows: lastSequence ? [{ last_sequence: lastSequence }] : [],
        rowCount: lastSequence ? 1 : 0
      };
    }

    if (sql.includes('with upserted as ( insert into quotation_counters')) {
      const currentSequence = counters.get(dateKey) ?? 1100;
      const nextSequence = currentSequence + 1;
      counters.set(dateKey, nextSequence);
      return {
        rows: [{ last_sequence: nextSequence }],
        rowCount: 1
      };
    }

    return { rows: [], rowCount: 0 };
  })
}));

import { generateQuotationNumber, peekNextQuotationNumber } from '../src/services/quotation-number-service';

describe('quotation number service', () => {
  beforeEach(() => {
    counters.clear();
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

  test('peekNextQuotationNumber does not consume the counter', async () => {
    const referenceDate = new Date('2025-07-02T00:00:00Z');

    expect(await peekNextQuotationNumber(referenceDate)).toBe('2507021101');
    expect(await peekNextQuotationNumber(referenceDate)).toBe('2507021101');

    expect(await generateQuotationNumber(referenceDate)).toBe('2507021101');
    expect(await peekNextQuotationNumber(referenceDate)).toBe('2507021102');
  });
});