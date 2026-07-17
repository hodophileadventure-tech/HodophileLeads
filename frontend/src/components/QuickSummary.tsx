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
  deadLeads: number;
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
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [detailRows, setDetailRows] = useState<any[]>([]);

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
    setExpandedSection(null);
    setDetailRows([]);
    try {
      const response = await dashboardAPI.getAgentQuickSummary(selectedAgent, startDate, endDate);
      setData(response.data);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load summary');
    } finally {
      setLoading(false);
    }
  };

  const loadDetailRows = async (section: string) => {
    if (!selectedAgent || !startDate || !endDate) return;

    setDetailsLoading(true);
    setDetailError('');
    try {
      const response = await dashboardAPI.getAgentSummaryDetails(selectedAgent, section, startDate, endDate);
      setDetailRows(response.data);
    } catch (err: any) {
      setDetailError(err?.response?.data?.message || 'Failed to load detail rows');
      setDetailRows([]);
    } finally {
      setDetailsLoading(false);
    }
  };

  const leadsData = data ? [
    { name: 'Confirmed', value: data.confirmedLeads, color: COLORS.confirmed },
    { name: 'In Progress', value: data.inProgressLeads, color: COLORS.inProgress },
    { name: 'Potential', value: data.potentialLeads, color: COLORS.potential },
    { name: 'New', value: data.newLeads, color: '#60a5fa' },
    { name: 'Dead', value: data.deadLeads, color: '#6b7280' },
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
            <button type="button" onClick={() => {
              const next = expandedSection === 'totalLeads' ? null : 'totalLeads';
              setExpandedSection(next);
              if (next) loadDetailRows(next);
            }} className="text-left bg-blue-50 dark:bg-blue-900/30 p-3 rounded-lg">
              <p className="text-xs text-slate-600 dark:text-slate-400">Total Leads</p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-300">{data.totalLeads}</p>
            </button>
            <button type="button" onClick={() => {
              const next = expandedSection === 'confirmedLeads' ? null : 'confirmedLeads';
              setExpandedSection(next);
              if (next) loadDetailRows(next);
            }} className="text-left bg-green-50 dark:bg-green-900/30 p-3 rounded-lg">
              <p className="text-xs text-slate-600 dark:text-slate-400">Confirmed</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-300">{data.confirmedLeads}</p>
            </button>
            <button type="button" onClick={() => {
              const next = expandedSection === 'inProgressLeads' ? null : 'inProgressLeads';
              setExpandedSection(next);
              if (next) loadDetailRows(next);
            }} className="text-left bg-yellow-50 dark:bg-yellow-900/30 p-3 rounded-lg">
              <p className="text-xs text-slate-600 dark:text-slate-400">In Progress</p>
              <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-300">{data.inProgressLeads}</p>
            </button>
            <button type="button" onClick={() => {
              const next = expandedSection === 'potentialLeads' ? null : 'potentialLeads';
              setExpandedSection(next);
              if (next) loadDetailRows(next);
            }} className="text-left bg-purple-50 dark:bg-purple-900/30 p-3 rounded-lg">
              <p className="text-xs text-slate-600 dark:text-slate-400">Potential</p>
              <p className="text-2xl font-bold text-purple-600 dark:text-purple-300">{data.potentialLeads}</p>
            </button>
            <button type="button" onClick={() => {
              const next = expandedSection === 'newLeads' ? null : 'newLeads';
              setExpandedSection(next);
              if (next) loadDetailRows(next);
            }} className="text-left bg-sky-50 dark:bg-sky-900/30 p-3 rounded-lg">
              <p className="text-xs text-slate-600 dark:text-slate-400">New</p>
              <p className="text-2xl font-bold text-sky-600 dark:text-sky-300">{data.newLeads}</p>
            </button>
            <button type="button" onClick={() => {
              const next = expandedSection === 'deadLeads' ? null : 'deadLeads';
              setExpandedSection(next);
              if (next) loadDetailRows(next);
            }} className="text-left bg-gray-50 dark:bg-gray-900/30 p-3 rounded-lg">
              <p className="text-xs text-slate-600 dark:text-slate-400">Dead</p>
              <p className="text-2xl font-bold text-gray-600 dark:text-gray-300">{data.deadLeads}</p>
            </button>
            <button type="button" onClick={() => {
              const next = expandedSection === 'spamLeads' ? null : 'spamLeads';
              setExpandedSection(next);
              if (next) loadDetailRows(next);
            }} className="text-left bg-rose-50 dark:bg-rose-900/30 p-3 rounded-lg">
              <p className="text-xs text-slate-600 dark:text-slate-400">Spam</p>
              <p className="text-2xl font-bold text-rose-600 dark:text-rose-300">{data.spamLeads}</p>
            </button>
            <button type="button" onClick={() => {
              const next = expandedSection === 'canceledLeads' ? null : 'canceledLeads';
              setExpandedSection(next);
              if (next) loadDetailRows(next);
            }} className="text-left bg-red-50 dark:bg-red-900/30 p-3 rounded-lg">
              <p className="text-xs text-slate-600 dark:text-slate-400">Canceled</p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-300">{data.canceledLeads}</p>
            </button>
          </div>

          {expandedSection && (
            <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-lg font-semibold capitalize">{expandedSection.replace(/([A-Z])/g, ' $1')}</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Details for the selected summary metric</p>
                </div>
                <button
                  type="button"
                  onClick={() => setExpandedSection(null)}
                  className="text-sm text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                >
                  Close
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <p className="text-sm text-slate-500 dark:text-slate-400">Metric</p>
                  <p className="text-xl font-semibold mt-2">{expandedSection.replace(/([A-Z])/g, ' $1')}</p>
                </div>
                <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <p className="text-sm text-slate-500 dark:text-slate-400">Value</p>
                  <p className="text-xl font-semibold mt-2">
                    {data[
                      expandedSection as keyof SummaryData
                    ]}
                  </p>
                </div>
              </div>

              <div className="mt-4 p-4 bg-slate-100 dark:bg-slate-950 rounded-lg">
                {detailsLoading ? (
                  <div className="text-sm text-slate-600 dark:text-slate-300">Loading details...</div>
                ) : detailError ? (
                  <div className="text-sm text-red-600 dark:text-red-300">{detailError}</div>
                ) : detailRows.length === 0 ? (
                  <div className="text-sm text-slate-600 dark:text-slate-300">No matching leads found for this category in the selected range.</div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                        <p className="text-sm text-slate-500 dark:text-slate-400">Matching leads</p>
                        <p className="text-xl font-semibold mt-2">{detailRows.length}</p>
                      </div>
                      <div className="p-4 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                        <p className="text-sm text-slate-500 dark:text-slate-400">Context</p>
                        <p className="text-base leading-6 text-slate-700 dark:text-slate-300 mt-2">
                          {expandedSection === 'confirmedLeads' && 'Recently booked leads with status booked.'}
                          {expandedSection === 'inProgressLeads' && 'Leads currently in contact, interest, or negotiation stages.'}
                          {expandedSection === 'potentialLeads' && 'Promising leads marked as potential but not yet converted.'}
                          {expandedSection === 'newLeads' && 'Fresh leads created in the selected date range.'}
                          {expandedSection === 'deadLeads' && 'Leads marked dead or closed as completed/canceled.'}
                          {expandedSection === 'spamLeads' && 'Leads flagged as spam during the selected date range.'}
                          {expandedSection === 'canceledLeads' && 'Leads explicitly canceled with cancellation details.'}
                          {expandedSection === 'totalLeads' && 'All leads that match the selected date range and agent.'}
                          {expandedSection === 'panLeads' && 'Cold leads marked as not potential and likely low-priority.'}
                        </p>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="min-w-full text-left text-sm text-slate-700 dark:text-slate-200">
                        <thead className="bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100">
                          <tr>
                            <th className="px-3 py-2">Lead</th>
                            <th className="px-3 py-2">Phone</th>
                            <th className="px-3 py-2">Status</th>
                            <th className="px-3 py-2">Temperature</th>
                            <th className="px-3 py-2">Reason</th>
                            <th className="px-3 py-2">Remarks</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detailRows.map((row, index) => (
                            <tr key={`${row.id}-${index}`} className="border-b border-slate-200 dark:border-slate-700">
                              <td className="px-3 py-2">{row.client_name || 'Unknown'}</td>
                              <td className="px-3 py-2">{row.phone || '-'}</td>
                              <td className="px-3 py-2 capitalize">{row.status || '-'}</td>
                              <td className="px-3 py-2 capitalize">{row.temperature || '-'}</td>
                              <td className="px-3 py-2">{row.canceled_reason || row.remarks || row.agent_remarks || '-'}</td>
                              <td className="px-3 py-2">{row.agent_remarks || row.remarks || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

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
