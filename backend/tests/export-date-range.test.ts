import { buildLeadExportFilters } from '../src/utils/export-date-range';

describe('buildLeadExportFilters', () => {
  test('builds SQL filters for status and inclusive date range', () => {
    const result = buildLeadExportFilters({
      status: 'new',
      startDate: '2026-06-24',
      endDate: '2026-06-29'
    });

    expect(result.whereClause).toBe('WHERE l.status = $1 AND l.created_at::date >= $2::date AND l.created_at::date <= $3::date');
    expect(result.params).toEqual(['new', '2026-06-24', '2026-06-29']);
  });

  test('builds a status-only filter when no dates are provided', () => {
    const result = buildLeadExportFilters({ status: 'contacted' });

    expect(result.whereClause).toBe('WHERE l.status = $1');
    expect(result.params).toEqual(['contacted']);
  });
});
