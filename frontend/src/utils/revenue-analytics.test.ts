import { describe, expect, it } from 'vitest';
import { normalizeRevenueSeries } from './revenue-analytics';

describe('normalizeRevenueSeries', () => {
  it('aggregates month, quarter, and year totals from raw records', () => {
    const raw = [
      { period: '2025-01', label: 'Jan 2025', revenue: 25000, bookings: 3 },
      { period: '2025-01', label: 'Jan 2025', revenue: 15000, bookings: 2 },
      { period: '2025-02', label: 'Feb 2025', revenue: 30000, bookings: 4 },
      { period: '2025-Q1', label: 'Q1 2025', revenue: 70000, bookings: 9 },
      { period: '2025', label: '2025', revenue: 70000, bookings: 9 }
    ];

    const normalized = normalizeRevenueSeries(raw);

    expect(normalized.monthly).toEqual([
      { period: '2025-01', label: 'Jan 2025', revenue: 40000, bookings: 5 },
      { period: '2025-02', label: 'Feb 2025', revenue: 30000, bookings: 4 }
    ]);

    expect(normalized.quarterly).toContainEqual({ period: '2025-Q1', label: 'Q1 2025', revenue: 70000, bookings: 9 });
    expect(normalized.yearly).toContainEqual({ period: '2025', label: '2025', revenue: 70000, bookings: 9 });
  });
});
