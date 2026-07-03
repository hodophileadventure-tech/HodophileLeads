import React, { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Card, Spinner, Button } from './common';
import { dashboardAPI } from '../utils/api-service';

interface QuickSummaryProps {
  agents: any[];
}

interface SummaryData {
  confirmedLeads: number;
  inProgressLeads: number;
  potentialLeads: number;
  newLeads: number;
  spamLeads: number;
  canceledLeads: number;
  panLeads: number;
  totalLeads: number;
  totalFollowups: number;
  completedFollowups: number;
  pastDueFollowups: number;
  activeFollowups: number;
}

const COLORS = {
  confirmed: '#10b981',
  inProgress: '#3b82f6',
  potential: '#f59e0b',
  canceled: '#ef4444',
  pan: '#8b5cf6',
  completed: '#10b981',
  pastDue: '#ef4444',
  active: '#3b82f6'
};

export const QuickSummary: React.FC<QuickSummaryProps> = ({ agents }) => {
  const [selectedAgent, setSelectedAgent] = useState<string | null>(agents[0]?.id || null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<SummaryData | null>(null);
  const [error, setError] = useState('');

  // Set default date range to last 90 days
  useEffect(() => {
    const today = new Date();
    const ninetyDaysAgo = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000);
    
    setEndDate(today.toISOString().split('T')[0]);
    setStartDate(ninetyDaysAgo.toISOString().split('T')[0]);
  }, []);

  const handleFetchSummary = async () => {
    if (!selectedAgent || !startDate || !endDate) {
      setError('Please select an agent and date range');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const response = await dashboardAPI.getAgentQuickSummary(selectedAgent, startDate, endDate);
      setData(response.data);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load summary');
    } finally {
      setLoading(false);
    }
  };

  const leadsData = data ? [
    { name: 'Confirmed', value: data.confirmedLeads, color: COLORS.confirmed },
    { name: 'In Progress', value: data.inProgressLeads, color: COLORS.inProgress },
    { name: 'Potential', value: data.potentialLeads, color: COLORS.potential },
    { name: 'New', value: data.newLeads, color: '#60a5fa' },
    { name: 'Spam', value: data.spamLeads, color: '#9f1239' },
    { name: 'Pan Leads', value: data.panLeads, color: COLORS.pan },
    { name: 'Canceled', value: data.canceledLeads, color: COLORS.canceled }
  ].filter(item => item.value > 0) : [];

  const followupsData = data ? [
    { name: 'Completed', value: data.completedFollowups, color: COLORS.completed },
    { name: 'Past Due', value: data.pastDueFollowups, color: COLORS.pastDue },
    { name: 'Active', value: data.activeFollowups, color: COLORS.active }
  ].filter(item => item.value > 0) : [];

  const renderPieLabel = ({ cx, cy, midAngle, outerRadius, name, value }: any) => {
    const RADIAN = Math.PI / 180;
    const radius = outerRadius + 16;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text x={x} y={y} fill="#0f172a" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize={12} fontWeight={600}>
        {`${name}: ${value}`}
      </text>
    );
  };

  const totalLeadPieValue = leadsData.reduce((sum, item) => sum + item.value, 0);
  const hasLeadPieMismatch = data ? totalLeadPieValue !== data.totalLeads : false;

  return (
    <Card>
      <h2 className="text-2xl font-bold mb-6">Quick Summary</h2>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium mb-2">Select Agent</label>
          <select
            className="w-full border border-slate-300 dark:border-slate-600 rounded-lg p-2 dark:bg-slate-800 dark:text-white"
            value={selectedAgent || ''}
            onChange={(e) => setSelectedAgent(e.target.value)}
          >
            <option value="">Choose an agent...</option>
            {agents.map(agent => (
              <option key={agent.id} value={agent.id}>
                {agent.name || agent.email}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Start Date</label>
          <input
            type="date"
            className="w-full border border-slate-300 dark:border-slate-600 rounded-lg p-2 dark:bg-slate-800 dark:text-white"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">End Date</label>
          <input
            type="date"
            className="w-full border border-slate-300 dark:border-slate-600 rounded-lg p-2 dark:bg-slate-800 dark:text-white"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
      </div>

      <Button onClick={handleFetchSummary} disabled={!selectedAgent || !startDate || !endDate} className="mb-6">
        Generate Summary
      </Button>

      {error && (
        <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 rounded-lg">
          {error}
        </div>
      )}

      {loading && (
        <div className="flex justify-center py-8">
          <Spinner size="md" />
        </div>
      )}

      {data && !loading && (
        <div className="space-y-8">
          {/* Summary Statistics */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="bg-blue-50 dark:bg-blue-900/30 p-3 rounded-lg">
              <p className="text-xs text-slate-600 dark:text-slate-400">Total Leads</p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-300">{data.totalLeads}</p>
            </div>
            <div className="bg-green-50 dark:bg-green-900/30 p-3 rounded-lg">
              <p className="text-xs text-slate-600 dark:text-slate-400">Confirmed</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-300">{data.confirmedLeads}</p>
            </div>
            <div className="bg-yellow-50 dark:bg-yellow-900/30 p-3 rounded-lg">
              <p className="text-xs text-slate-600 dark:text-slate-400">In Progress</p>
              <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-300">{data.inProgressLeads}</p>
            </div>
            <div className="bg-purple-50 dark:bg-purple-900/30 p-3 rounded-lg">
              <p className="text-xs text-slate-600 dark:text-slate-400">Potential</p>
              <p className="text-2xl font-bold text-purple-600 dark:text-purple-300">{data.potentialLeads}</p>
            </div>
            <div className="bg-sky-50 dark:bg-sky-900/30 p-3 rounded-lg">
              <p className="text-xs text-slate-600 dark:text-slate-400">New</p>
              <p className="text-2xl font-bold text-sky-600 dark:text-sky-300">{data.newLeads}</p>
            </div>
            <div className="bg-rose-50 dark:bg-rose-900/30 p-3 rounded-lg">
              <p className="text-xs text-slate-600 dark:text-slate-400">Spam</p>
              <p className="text-2xl font-bold text-rose-600 dark:text-rose-300">{data.spamLeads}</p>
            </div>
            <div className="bg-red-50 dark:bg-red-900/30 p-3 rounded-lg">
              <p className="text-xs text-slate-600 dark:text-slate-400">Canceled</p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-300">{data.canceledLeads}</p>
            </div>
          </div>

          {/* Pie Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Leads Distribution */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Lead Distribution</h3>
              {leadsData.length > 0 ? (
                <ResponsiveContainer width="100%" height={350}>
                  <PieChart margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
                    <Pie
                      data={leadsData}
                      cx="50%"
                      cy="45%"
                      labelLine={true}
                      label={renderPieLabel}
                      outerRadius={90}
                      innerRadius={40}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {leadsData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => `${value} leads`} />
                    <Legend verticalAlign="bottom" height={50} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-slate-600 dark:text-slate-400 text-center py-8">No lead data available</p>
              )}
              {hasLeadPieMismatch && (
                <div className="mt-3 text-sm text-yellow-700 dark:text-yellow-300">
                  Note: lead pie segments total {totalLeadPieValue}, but overall total leads is {data?.totalLeads}.
                </div>
              )}
            </div>

            {/* Follow-ups Distribution */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Follow-up Status</h3>
              <div className="space-y-3 mb-4">
                <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <span>Total Follow-ups</span>
                  <span className="font-bold text-lg">{data.totalFollowups}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-green-50 dark:bg-green-900/30 rounded-lg">
                  <span>Completed</span>
                  <span className="font-bold text-lg text-green-600 dark:text-green-300">{data.completedFollowups}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-red-50 dark:bg-red-900/30 rounded-lg">
                  <span>Past Due</span>
                  <span className="font-bold text-lg text-red-600 dark:text-red-300">{data.pastDueFollowups}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                  <span>Active</span>
                  <span className="font-bold text-lg text-blue-600 dark:text-blue-300">{data.activeFollowups}</span>
                </div>
              </div>

              {followupsData.length > 0 && (
                <ResponsiveContainer width="100%" height={350}>
                  <PieChart margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
                    <Pie
                      data={followupsData}
                      cx="50%"
                      cy="45%"
                      labelLine={true}
                      label={renderPieLabel}
                      outerRadius={90}
                      innerRadius={40}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {followupsData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => `${value} followups`} />
                    <Legend verticalAlign="bottom" height={50} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
};
