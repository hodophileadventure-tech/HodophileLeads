export type RevenueSeriesPoint = {
  period: string;
  label: string;
  revenue: number;
  bookings: number;
};

export type RevenueSeries = {
  monthly: RevenueSeriesPoint[];
  quarterly: RevenueSeriesPoint[];
  yearly: RevenueSeriesPoint[];
};

const toNumber = (value: unknown) => {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
};

export const normalizeRevenueSeries = (rows: Array<Record<string, unknown>>): RevenueSeries => {
  const monthlyMap = new Map<string, RevenueSeriesPoint>();
  const quarterlyMap = new Map<string, RevenueSeriesPoint>();
  const yearlyMap = new Map<string, RevenueSeriesPoint>();

  for (const row of rows) {
    const rawPeriod = String(row.period ?? '').trim();
    const label = String(row.label ?? (rawPeriod || 'Unknown'));
    const revenue = toNumber(row.revenue);
    const bookings = Math.max(0, Math.round(toNumber(row.bookings)));

    if (!rawPeriod) continue;

    if (rawPeriod.includes('-') && !rawPeriod.includes('Q')) {
      const current = monthlyMap.get(rawPeriod) ?? { period: rawPeriod, label, revenue: 0, bookings: 0 };
      current.revenue += revenue;
      current.bookings += bookings;
      current.label = label;
      monthlyMap.set(rawPeriod, current);
    }

    if (/Q\d$/.test(rawPeriod) || /Q\d/.test(String(rawPeriod))) {
      const current = quarterlyMap.get(rawPeriod) ?? { period: rawPeriod, label, revenue: 0, bookings: 0 };
      current.revenue += revenue;
      current.bookings += bookings;
      current.label = label;
      quarterlyMap.set(rawPeriod, current);
    }

    if (/^\d{4}$/.test(rawPeriod)) {
      const current = yearlyMap.get(rawPeriod) ?? { period: rawPeriod, label, revenue: 0, bookings: 0 };
      current.revenue += revenue;
      current.bookings += bookings;
      current.label = label;
      yearlyMap.set(rawPeriod, current);
    }
  }

  return {
    monthly: Array.from(monthlyMap.values()).sort((a, b) => a.period.localeCompare(b.period)),
    quarterly: Array.from(quarterlyMap.values()).sort((a, b) => a.period.localeCompare(b.period)),
    yearly: Array.from(yearlyMap.values()).sort((a, b) => a.period.localeCompare(b.period))
  };
};
