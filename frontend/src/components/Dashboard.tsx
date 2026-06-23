import React, { useEffect, useState } from 'react';
import { dashboardAPI } from '../utils/api-service';
import { formatCurrency, getHealthScoreColor } from '../utils/helpers';
import { Card, Spinner } from './common';

interface StatCard {
  label: string;
  value: string | number;
  color: string;
}

export const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

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
      label: 'Bookings This Month',
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
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <Card key={stat.label} className={stat.color}>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
              {stat.label}
            </p>
            <p className="text-3xl font-bold">{stat.value}</p>
          </Card>
        ))}
      </div>

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
