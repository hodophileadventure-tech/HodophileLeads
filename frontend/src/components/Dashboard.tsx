import React, { useEffect, useMemo, useState } from 'react';
import { dashboardAPI } from '../utils/api-service';
import { formatCurrency, getHealthScoreColor } from '../utils/helpers';
import { Card, Spinner } from './common';

interface StatCard {
  label: string;
  value: string | number;
  color: string;
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
      color: 'bg-blue-100 dark:bg-blue-900'
    },
    {
      label: 'Hot Leads',
      value: stats.hotLeads || 0,
      color: 'bg-red-100 dark:bg-red-900'
    },
    {
      label: 'Confirmed Leads',
      value: stats.bookingsThisMonth || 0,
      color: 'bg-green-100 dark:bg-green-900'
    },
    {
      label: 'Total Revenue',
      value: formatCurrency(stats.totalRevenue || 0),
      color: 'bg-purple-100 dark:bg-purple-900'
    }
  ];

  return (
    <div className="space-y-6 px-4 md:px-6 lg:px-8">
      <h1 className="text-2xl md:text-3xl font-bold">Dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <Card key={stat.label} className={`${stat.color} shadow-sm`}>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1 truncate">
              {stat.label}
            </p>
            <p className="text-2xl md:text-3xl font-bold truncate">{stat.value}</p>
          </Card>
        ))}
      </div>

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

          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="flex items-center justify-center">
              <div className="relative flex h-28 w-28 md:h-36 md:w-36 items-center justify-center rounded-full shadow-inner" style={pieStyle}>
                <div className="flex h-20 w-20 md:h-28 md:w-28 items-center justify-center rounded-full bg-white dark:bg-slate-900 text-center">
                  <div>
                    <p className="text-xs text-slate-500">Achieved</p>
                    <p className="text-lg md:text-xl font-bold">{monthlyTargetProgress}%</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex-1 space-y-2 max-w-full overflow-visible">
              <p className="text-sm font-semibold">{selectedBreakdownConfig.label} breakdown</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {breakdownSegments.map((segment) => (
                  <div key={segment.label} className="rounded-lg border border-slate-100 dark:border-slate-700 p-3 text-sm bg-white dark:bg-slate-800">
                    <div className="flex flex-col gap-2">
                      <div className="flex items-start justify-between gap-4">
                        <span className="font-medium text-slate-900 dark:text-slate-100">{segment.label}</span>
                        <span className="text-xs text-slate-500 whitespace-nowrap">Remaining: {formatCurrency(segment.remaining)}</span>
                      </div>
                      <div className="grid gap-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                        <div className="flex items-center justify-between gap-2">
                          <span>Achieved</span>
                          <span>{formatCurrency(segment.achieved)}</span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span>Target</span>
                          <span>{formatCurrency(segment.target)}</span>
                        </div>
                      </div>
                      <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-2 overflow-hidden mt-2">
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
