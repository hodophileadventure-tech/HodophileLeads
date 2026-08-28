import React, { useEffect, useMemo, useState } from 'react';
import { dashboardAPI } from '../utils/api-service';
import { formatCurrency, getHealthScoreColor } from '../utils/helpers';
import { Card, Spinner } from './common';
import { useAuth } from '../context/AuthContext';

interface StatCard {
  label: string;
  value: string | number;
  color: string;
  detail: string;
}

type BreakdownKey = 'weekly' | 'fortnightly' | 'tenDay';

const breakdownOptions: Array<{ key: BreakdownKey; label: string; segments: number; unit: string }> = [
  { key: 'weekly', label: 'Weekly', segments: 4, unit: 'Week' },
  { key: 'fortnightly', label: 'Fortnightly', segments: 2, unit: 'Fortnight' },
  { key: 'tenDay', label: '10 Days', segments: 3, unit: '10-day block' }
];

const getBreakdownSegments = (target: number, segments: number, achieved: number) => {
  const baseTarget = Math.ceil(target / segments);
  const remainder = target % segments;
  return Array.from({ length: segments }, (_, index) => {
    const segmentTarget = baseTarget + (index < remainder ? 1 : 0);
    const segmentStart = index * baseTarget + Math.min(index, remainder);
    const segmentAchieved = Math.max(0, Math.min(segmentTarget, achieved - segmentStart));
    return {
      label: segments === 4 ? `Week ${index + 1}` : segments === 2 ? `Half ${index + 1}` : `Block ${index + 1}`,
      target: segmentTarget,
      achieved: segmentAchieved,
      remaining: Math.max(0, segmentTarget - segmentAchieved)
    };
  });
};

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedBreakdown, setSelectedBreakdown] = useState<BreakdownKey>('weekly');

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await dashboardAPI.getStats();
        setStats(response.data);
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      } finally {
        setLoading(false);
      }
    };

    const handleRefresh = () => {
      setLoading(true);
      fetchStats();
    };

    window.addEventListener('dashboard-refresh', handleRefresh);
    fetchStats();

    return () => {
      window.removeEventListener('dashboard-refresh', handleRefresh);
    };
  }, []);

  const monthlyTarget = Number(stats?.monthlyTarget || 5_000_000);
  const monthlyTargetAchieved = Number(stats?.monthlyTargetAchieved || stats?.totalRevenue || 0);
  const monthlyTargetProgress = Number(stats?.monthlyTargetProgress || 0);
  const monthlyTargetRemaining = Number(stats?.monthlyTargetRemaining || Math.max(0, monthlyTarget - monthlyTargetAchieved));

  const today = new Date();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const daysElapsed = Math.min(today.getDate(), daysInMonth);
  const dailyTarget = monthlyTarget / daysInMonth;
  const currentPace = monthlyTargetAchieved / Math.max(1, daysElapsed);
  const paceStatus = currentPace >= dailyTarget ? 'On track' : 'Needs more pace';

  const birthdayAge = (() => {
    if (user?.role === 'admin' || !user?.date_of_birth) return null;
    const birthDate = new Date(user.date_of_birth);
    const now = new Date();
    let age = now.getFullYear() - birthDate.getFullYear();
    const birthdayPassed = now.getMonth() > birthDate.getMonth()
      || (now.getMonth() === birthDate.getMonth() && now.getDate() >= birthDate.getDate());
    if (!birthdayPassed) age -= 1;
    return now.getMonth() === birthDate.getMonth() && now.getDate() === birthDate.getDate() ? age : null;
  })();

  const selectedBreakdownConfig = breakdownOptions.find((item) => item.key === selectedBreakdown) || breakdownOptions[0];
  const breakdownSegments = useMemo(
    () => getBreakdownSegments(monthlyTarget, selectedBreakdownConfig.segments, monthlyTargetAchieved),
    [monthlyTarget, monthlyTargetAchieved, selectedBreakdownConfig.segments]
  );

  const piePercent = Math.min(100, Math.max(0, monthlyTargetProgress));
  const pieStyle = {
    background: `conic-gradient(#10b981 0deg ${piePercent * 3.6}deg, #e2e8f0 ${piePercent * 3.6}deg 360deg)`
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!stats) {
    return <Card>Failed to load dashboard data</Card>;
  }

  const statCards: StatCard[] = [
    {
      label: 'Total Leads',
      value: stats.totalLeads || 0,
      color: 'bg-blue-100 dark:bg-blue-900',
      detail: 'Across your active pipeline'
    },
    {
      label: 'Hot Leads',
      value: stats.hotLeads || 0,
      color: 'bg-red-100 dark:bg-red-900',
      detail: 'Need a timely response'
    },
    {
      label: 'Confirmed Leads',
      // Show total confirmed leads (align with Leads view)
      value: stats.totalConfirmed || stats.bookingsThisMonth || 0,
      color: 'bg-green-100 dark:bg-green-900',
      detail: 'Bookings secured'
    },
    {
      label: 'Total Revenue',
      value: formatCurrency(stats.totalRevenue || 0),
      color: 'bg-purple-100 dark:bg-purple-900',
      detail: 'Confirmed booking value'
    }
  ];

  return (
    <div className="space-y-6 px-4 md:px-6 lg:px-8">
      <div className="dashboard-hero rounded-2xl p-6 md:p-8">
        <div className="relative z-10 max-w-2xl">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-cyan-200">Sales command center</p>
          <h1 className="text-3xl font-black md:text-4xl">Good work, {user?.name?.split(' ')[0] || 'team'}.</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-slate-100">Your pipeline, follow-ups, and revenue momentum are all in view. Keep the next best conversation moving.</p>
          <div className="mt-5 flex flex-wrap gap-3 text-xs font-semibold">
            <span className="rounded-full bg-white/15 px-3 py-2 text-white">{stats.totalLeads || 0} active leads</span>
            <span className="rounded-full bg-emerald-400/20 px-3 py-2 text-emerald-100">{paceStatus}</span>
          </div>
        </div>
      </div>

      {birthdayAge !== null && (
        <Card className="border border-amber-200 bg-amber-50 shadow-sm">
          <h2 className="text-xl font-bold text-amber-900">Happy Birthday, {user?.name}!</h2>
          <p className="mt-1 text-amber-800">Hodophile gives you many congratulations on your birthday. Congratulations, you have turned {birthdayAge}!</p>
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <Card key={stat.label} className={`stat-tile ${stat.color} shadow-sm`}>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-400 mb-2 truncate">
              {stat.label}
            </p>
            <p className="text-2xl md:text-3xl font-bold truncate">{stat.value}</p>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{stat.detail}</p>
          </Card>
        ))}
      </div>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-[1.3fr_.7fr]">
        <div className="rounded-lg border border-slate-800 bg-slate-900 p-5 text-white shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.16em] text-amber-300">Requires attention</p>
              <h2 className="mt-2 text-xl font-bold text-white">Keep the next conversation moving</h2>
            </div>
            <span className="rounded-md bg-white/10 px-2.5 py-1 text-xs font-semibold text-slate-300">Live signals</span>
          </div>
          <div className="mt-5 grid gap-2 sm:grid-cols-3">
            <div className="border-l-2 border-rose-400 pl-3">
              <p className="text-2xl font-bold text-white">{stats.hotLeads || 0}</p>
              <p className="text-xs text-slate-400">Hot leads</p>
            </div>
            <div className="border-l-2 border-amber-400 pl-3">
              <p className="text-2xl font-bold text-white">{stats.overdueTasks || 0}</p>
              <p className="text-xs text-slate-400">Overdue follow-ups</p>
            </div>
            <div className="border-l-2 border-sky-400 pl-3">
              <p className="text-2xl font-bold text-white">{stats.pendingPayments || 0}</p>
              <p className="text-xs text-slate-400">Pending payments</p>
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-[var(--line)] bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[.16em] text-slate-500">Pipeline pulse</p>
          <div className="mt-4 flex items-end justify-between gap-4">
            <div>
              <p className="text-3xl font-bold text-[var(--text)]">{stats.negotiationLeads || 0}</p>
              <p className="mt-1 text-sm text-[var(--muted)]">Leads in negotiation</p>
            </div>
            <span className="rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">{paceStatus}</span>
          </div>
          <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-amber-400 transition-all duration-500" style={{ width: `${Math.max(8, Math.min(100, monthlyTargetProgress))}%` }} />
          </div>
          <p className="mt-2 text-xs text-slate-500">{monthlyTargetProgress}% of monthly target achieved</p>
        </div>
      </section>

      <Card className="bg-white dark:bg-slate-900 shadow-md rounded-3xl p-8 min-h-[30rem] lg:min-h-[32rem]">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg md:text-xl font-bold">Monthly Target Tracker</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Track confirmed revenue against the monthly goal.</p>
          </div>
          <div className="flex-shrink-0 flex gap-2">
            {breakdownOptions.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setSelectedBreakdown(item.key)}
                className={`rounded-full px-3 py-1 text-sm font-medium ${selectedBreakdown === item.key ? 'bg-emerald-600 text-white shadow' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200'}`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm text-slate-500 dark:text-slate-400">Monthly target</p>
                <p className="text-2xl md:text-3xl font-bold truncate">{formatCurrency(monthlyTargetAchieved)} <span className="text-base font-normal text-slate-500">/</span> {formatCurrency(monthlyTarget)}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-slate-500 dark:text-slate-400">Remaining</p>
                <p className="text-xl md:text-2xl font-semibold text-amber-600">{formatCurrency(monthlyTargetRemaining)}</p>
              </div>
            </div>

            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-3">
              <div className="h-3 rounded-full bg-emerald-500 transition-all" style={{ width: `${monthlyTargetProgress}%` }} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
              <div className="rounded-lg border border-slate-100 dark:border-slate-700 p-3 bg-white dark:bg-slate-800">
                <p className="text-slate-500">Daily target</p>
                <p className="font-semibold">{formatCurrency(dailyTarget)} / day</p>
              </div>
              <div className="rounded-lg border border-slate-100 dark:border-slate-700 p-3 bg-white dark:bg-slate-800">
                <p className="text-slate-500">Current pace</p>
                <p className="font-semibold">{formatCurrency(currentPace)} / day</p>
              </div>
              <div className="rounded-lg border border-slate-100 dark:border-slate-700 p-3 bg-white dark:bg-slate-800">
                <p className="text-slate-500">Status</p>
                <p className={`font-semibold ${paceStatus === 'On track' ? 'text-emerald-600' : 'text-amber-600'}`}>{paceStatus}</p>
              </div>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row items-stretch gap-6">
            <div className="flex items-center justify-center lg:w-1/3">
              <div className="relative flex h-28 w-28 md:h-36 md:w-36 items-center justify-center rounded-full shadow-inner" style={pieStyle}>
                <div className="flex h-20 w-20 md:h-28 md:w-28 items-center justify-center rounded-full bg-white dark:bg-slate-900 text-center">
                  <div>
                    <p className="text-xs text-slate-500">Achieved</p>
                    <p className="text-lg md:text-xl font-bold">{monthlyTargetProgress}%</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex-1 space-y-3">
              <p className="text-sm font-semibold">{selectedBreakdownConfig.label} breakdown</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {breakdownSegments.map((segment) => (
                  <div key={segment.label} className="rounded-lg border border-slate-100 dark:border-slate-700 p-4 text-sm bg-white dark:bg-slate-800 min-h-[12rem]">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <p className="font-medium text-slate-900 dark:text-slate-100">{segment.label}</p>
                        <p className="text-xs text-slate-500">Remaining</p>
                        <p className="text-base font-semibold text-slate-900 dark:text-slate-100">{formatCurrency(segment.remaining)}</p>
                      </div>
                      <div className="space-y-3 text-sm text-slate-900 dark:text-slate-100">
                        <div className="space-y-1">
                          <p className="text-slate-500">Achieved</p>
                          <p className="font-semibold">{formatCurrency(segment.achieved)}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-slate-500">Target</p>
                          <p className="font-semibold">{formatCurrency(segment.target)}</p>
                        </div>
                      </div>
                      <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                        <div className="h-2 rounded-full bg-emerald-500 transition-all" style={{ width: `${Math.min(100, Math.round((segment.achieved / Math.max(1, segment.target)) * 100))}%` }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <h2 className="text-xl font-bold mb-4">Pipeline Health</h2>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span>Overall Score</span>
              <span className={`inline-block w-4 h-4 rounded-full ${getHealthScoreColor(stats.pipelineHealth || 'green')}`} />
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
              <div
                className={`h-full rounded-full ${getHealthScoreColor(stats.pipelineHealth || 'green')}`}
                style={{ width: '75%' }}
              />
            </div>
          </div>
        </Card>

        <Card>
          <h2 className="text-xl font-bold mb-4">Quick Stats</h2>
          <ul className="space-y-2 text-sm">
            <li className="flex justify-between">
              <span>Leads in Negotiation</span>
              <span className="font-medium">{stats.negotiationLeads || 0}</span>
            </li>
            <li className="flex justify-between">
              <span>Pending Payments</span>
              <span className="font-medium">{stats.pendingPayments || 0}</span>
            </li>
            <li className="flex justify-between">
              <span>Overdue Tasks</span>
              <span className="font-medium text-red-500">{stats.overdueTasks || 0}</span>
            </li>
          </ul>
        </Card>
      </div>
    </div>
  );
};
