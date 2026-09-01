import React, { useEffect, useMemo, useState } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { adminAPI } from '../utils/api-service';
import { formatCurrency } from '../utils/helpers';
import { normalizeRevenueSeries, type RevenueSeries, type RevenueSeriesPoint } from '../utils/revenue-analytics';

const currency = (value: number) => formatCurrency(value || 0);

const buildSummary = (rows: RevenueSeriesPoint[] = []) => {
  const totalRevenue = rows.reduce((sum, row) => sum + Number(row.revenue || 0), 0);
  const totalBookings = rows.reduce((sum, row) => sum + Number(row.bookings || 0), 0);
  const latest = rows[rows.length - 1];
  const previous = rows[rows.length - 2] ?? latest;
  const change = latest && previous && Number(previous.revenue || 0) !== 0
    ? ((Number(latest.revenue || 0) - Number(previous.revenue || 0)) / Number(previous.revenue || 0)) * 100
    : 0;

  return {
    totalRevenue,
    totalBookings,
    latestLabel: latest?.label || 'N/A',
    latestRevenue: latest?.revenue || 0,
    change
  };
};

export const AdminRevenueDashboard: React.FC = () => {
  const [series, setSeries] = useState<RevenueSeries>({ monthly: [], quarterly: [], yearly: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        setLoading(true);
        setError('');
        const response = await (adminAPI as any).getRevenueTrends();
        const raw = Array.isArray(response?.data?.series?.monthly)
          ? response.data.series
          : { monthly: [], quarterly: [], yearly: [] };
        const normalized = normalizeRevenueSeries([
          ...((raw.monthly || []) as any[]),
          ...((raw.quarterly || []) as any[]),
          ...((raw.yearly || []) as any[])
        ]);

        if (!active) return;
        setSeries(normalized);
      } catch (err) {
        if (!active) return;
        setError('Revenue analytics is unavailable right now.');
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    return () => { active = false; };
  }, []);

  const monthlySummary = useMemo(() => buildSummary(series.monthly), [series.monthly]);
  const quarterlySummary = useMemo(() => buildSummary(series.quarterly), [series.quarterly]);
  const yearlySummary = useMemo(() => buildSummary(series.yearly), [series.yearly]);

  return (
    <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.12em] text-amber-600">Revenue intelligence</p>
          <h2 className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">Revenue insights</h2>
        </div>
        <div className="text-xs text-slate-500 dark:text-slate-300">Monthly · Quarterly · Yearly</div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      )}

      {loading ? (
        <div className="flex min-h-[280px] items-center justify-center text-sm text-slate-500">Loading revenue trends…</div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/80">
              <p className="text-xs font-semibold uppercase tracking-[.12em] text-slate-500">Monthly</p>
              <p className="mt-3 text-2xl font-bold text-slate-900 dark:text-white">{currency(monthlySummary.totalRevenue)}</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">{monthlySummary.totalBookings} bookings</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/80">
              <p className="text-xs font-semibold uppercase tracking-[.12em] text-slate-500">Quarterly</p>
              <p className="mt-3 text-2xl font-bold text-slate-900 dark:text-white">{currency(quarterlySummary.totalRevenue)}</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">{quarterlySummary.totalBookings} bookings</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/80">
              <p className="text-xs font-semibold uppercase tracking-[.12em] text-slate-500">Yearly</p>
              <p className="mt-3 text-2xl font-bold text-slate-900 dark:text-white">{currency(yearlySummary.totalRevenue)}</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">{yearlySummary.totalBookings} bookings</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Monthly revenue</p>
                  <p className="text-xs text-slate-500">{monthlySummary.latestLabel}</p>
                </div>
                <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">
                  {monthlySummary.change >= 0 ? '+' : ''}{monthlySummary.change.toFixed(1)}%
                </span>
              </div>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={series.monthly} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                    <defs>
                      <linearGradient id="revenueMonthFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#fbbf24" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#fbbf24" stopOpacity={0.04} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} stroke="#e2e8f0" strokeDasharray="4 4" />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} interval={0} />
                    <YAxis tickFormatter={(value) => `PKR ${Number(value) / 1000000}M`} tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} width={60} />
                    <Tooltip formatter={(value: number) => [currency(Number(value)), 'Revenue']} labelStyle={{ fontWeight: 700 }} contentStyle={{ borderRadius: 10, borderColor: '#dbe2ea' }} />
                    <Area type="monotone" dataKey="revenue" stroke="#f59e0b" strokeWidth={2.5} fill="url(#revenueMonthFill)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Quarterly revenue</p>
                  <p className="text-xs text-slate-500">{quarterlySummary.latestLabel}</p>
                </div>
              </div>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={series.quarterly} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="#e2e8f0" strokeDasharray="4 4" />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} />
                    <YAxis tickFormatter={(value) => `PKR ${Number(value) / 1000000}M`} tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} width={60} />
                    <Tooltip formatter={(value: number) => [currency(Number(value)), 'Revenue']} labelStyle={{ fontWeight: 700 }} contentStyle={{ borderRadius: 10, borderColor: '#dbe2ea' }} />
                    <Bar dataKey="revenue" fill="#0f172a" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Yearly revenue</p>
                <p className="text-xs text-slate-500">Cumulative revenue trend</p>
              </div>
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={series.yearly} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="#e2e8f0" strokeDasharray="4 4" />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} />
                  <YAxis tickFormatter={(value) => `PKR ${Number(value) / 1000000}M`} tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} width={60} />
                  <Tooltip formatter={(value: number) => [currency(Number(value)), 'Revenue']} labelStyle={{ fontWeight: 700 }} contentStyle={{ borderRadius: 10, borderColor: '#dbe2ea' }} />
                  <Line type="monotone" dataKey="revenue" stroke="#2563eb" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </section>
  );
};
