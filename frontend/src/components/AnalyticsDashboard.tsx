import React, { useEffect, useMemo, useState } from 'react';
import { Card, Spinner, Button } from './common';
import { dashboardAPI, adminAPI } from '../utils/api-service';
import type { Lead } from '../types';
import { formatCurrency, formatKarachiDateTime } from '../utils/helpers';

interface AnalyticsDashboardProps {
  isAdmin: boolean;
}

interface PipelineRow {
  status: string;
  temperature: string;
  count: string | number;
}

interface AnalyticsData {
  hot_leads: string | number;
  warm_leads: string | number;
  cold_leads: string | number;
  dead_leads: string | number;
  avg_budget: string | number;
  total_agents: string | number;
}

interface AdminOverviewSummary {
  todayLeads: number;
  totalLeads: number;
  canceledLeads: number;
  canceledFollowUps: number;
}

interface AdminOverviewAgent {
  id: string;
  email: string;
  name: string;
  role: string;
  last_login_at?: string | null;
  last_logout_at?: string | null;
  total_leads?: string | number;
  today_leads?: string | number;
  canceled_leads?: string | number;
  canceled_followups?: string | number;
}

interface AdminOverviewLead {
  id: string;
  client_name: string;
  email: string;
  phone: string;
  destination: string;
  status: string;
  temperature: string;
  created_at: string;
  updated_at: string;
  agent_id: string;
  agent_name: string;
  agent_email: string;
  follow_up_count?: string | number;
  canceled_followups?: string | number;
}

interface AdminOverview {
  summary: AdminOverviewSummary;
  agents: AdminOverviewAgent[];
  leads: AdminOverviewLead[];
  canceledLeads: Array<{
    id: string;
    client_name: string;
    email: string;
    phone: string;
    destination: string;
    canceled_reason?: string | null;
    canceled_at?: string | null;
    agent_name: string;
    agent_email: string;
    canceled_by_name?: string;
    canceled_by_email?: string;
  }>;
  canceledFollowUps: Array<{
    id: string;
    title: string;
    description?: string;
    canceled_reason?: string | null;
    canceled_at?: string | null;
    client_name: string;
    agent_name: string;
    agent_email: string;
    canceled_by_name?: string;
    canceled_by_email?: string;
  }>;
}

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ isAdmin }) => {
  const [pipeline, setPipeline] = useState<PipelineRow[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [agents, setAgents] = useState<any[]>([]);
  const [agentStats, setAgentStats] = useState<Record<string, any>>({});
  const [agentRevenue, setAgentRevenue] = useState<Record<string, any>>({});
  const [adminOverview, setAdminOverview] = useState<AdminOverview | null>(null);
  const [newAgentOpen, setNewAgentOpen] = useState(false);
  const [newAgentEmail, setNewAgentEmail] = useState('');
  const [newAgentName, setNewAgentName] = useState('');
  const [newAgentPassword, setNewAgentPassword] = useState('');
  const [newAgentRole, setNewAgentRole] = useState('agent');
  const [selectedAgent, setSelectedAgent] = useState<any | null>(null);
  const [agentLeads, setAgentLeads] = useState<Lead[]>([]);
  const [loadingAgentLeads, setLoadingAgentLeads] = useState(false);
  const [screenshotRequestId, setScreenshotRequestId] = useState<string | null>(null);
  const [screenshotLoading, setScreenshotLoading] = useState(false);
  const [screenshotResult, setScreenshotResult] = useState<{
    requestId: string;
    agentId: string;
    screenshot?: { id: string; url: string; expires_at?: string; created_at?: string };
    error?: string;
    capturedAt?: string;
  } | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setError('');

        const pipelineResponse = await dashboardAPI.getPipeline();
        setPipeline(Array.isArray(pipelineResponse.data) ? pipelineResponse.data : []);

        if (isAdmin) {
          const analyticsResponse = await dashboardAPI.getAnalytics();
          setAnalytics(analyticsResponse.data || null);
        }
      } catch (err: any) {
        const message = err?.response?.status === 403
          ? 'Analytics is available for admin users only.'
          : 'Failed to load analytics data.';
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [isAdmin]);

  const totals = useMemo(() => {
    const statusTotals: Record<string, number> = {};

    for (const row of pipeline) {
      const status = row.status || 'unknown';
      const count = Number(row.count || 0);
      statusTotals[status] = (statusTotals[status] || 0) + count;
    }

    return statusTotals;
  }, [pipeline]);

  const refreshAgentsAndStats = async () => {
    try {
      const resp = await (adminAPI as any).getAgents();
      setAgents(Array.isArray(resp.data?.agents) ? resp.data.agents : []);
      // fetch follow-up stats
      const statsResp = await (adminAPI as any).getAgentsFollowUpStats();
      const statsArr = Array.isArray(statsResp.data?.stats) ? statsResp.data.stats : [];
      const map: Record<string, any> = {};
      for (const s of statsArr) map[s.agent_id || s.id || s.agentId] = s;
      setAgentStats(map);
      // fetch revenue stats
      const revResp = await (adminAPI as any).getAgentsRevenueStats();
      const revArr = Array.isArray(revResp.data?.stats) ? revResp.data.stats : [];
      const revMap: Record<string, any> = {};
      for (const r of revArr) revMap[r.agent_id || r.id || r.agentId] = r;
      setAgentRevenue(revMap);

      const overviewResp = await (adminAPI as any).getOverview();
      const overview = overviewResp.data;
      setAdminOverview(overview?.summary ? overview : null);
    } catch (e) {
      console.error('Failed to load agents', e);
    }
  };

  useEffect(() => {
    if (!isAdmin) return;
    refreshAgentsAndStats();
  }, [isAdmin]);

  useEffect(() => {
    const handleScreenshotResult = (event: Event) => {
      const detail = (event as CustomEvent).detail as { requestId?: string; agentId?: string; screenshot?: { id: string; url: string; expires_at?: string; created_at?: string }; error?: string; capturedAt?: string } | undefined;
      if (!detail?.requestId) {
        return;
      }

      setScreenshotResult({
        requestId: detail.requestId,
        agentId: detail.agentId || selectedAgent?.id || '',
        screenshot: detail.screenshot,
        error: detail.error,
        capturedAt: detail.capturedAt
      });

      if (screenshotRequestId === detail.requestId) {
        setScreenshotRequestId(null);
      }
    };

    window.addEventListener('screen-capture-result', handleScreenshotResult as EventListener);
    return () => {
      window.removeEventListener('screen-capture-result', handleScreenshotResult as EventListener);
    };
  }, [screenshotRequestId, selectedAgent?.id]);

  const handleViewAgent = async (agent: any) => {
    setSelectedAgent(agent);
    setScreenshotResult(null);
    setScreenshotRequestId(null);
    setLoadingAgentLeads(true);
    try {
      const resp = await (adminAPI as any).getAgentLeads(agent.id);
      setAgentLeads(Array.isArray(resp.data?.leads) ? resp.data.leads : []);
    } catch (e) {
      console.error('Failed to load agent leads', e);
      setAgentLeads([]);
    } finally {
      setLoadingAgentLeads(false);
    }
  };

  const handleEditAgent = async (agent: any) => {
    const email = window.prompt('New email for agent', agent.email) || agent.email;
    const name = window.prompt('New name for agent', agent.name) || agent.name;
    try {
      const resp = await (adminAPI as any).updateAgent(agent.id, { email, name });
      const updated = resp.data?.agent;
      setAgents(prev => prev.map(a => (a.id === updated.id ? updated : a)));
    } catch (e) {
      console.error('Failed to update agent', e);
      alert('Failed to update agent');
    }
  };

  const handleDeleteAgent = async (agent: any) => {
    if (!confirm(`Delete agent ${agent.name || agent.email}? This cannot be undone.`)) return;
    try {
      await (adminAPI as any).deleteAgent(agent.id);
      if (selectedAgent?.id === agent.id) {
        setSelectedAgent(null);
        setAgentLeads([]);
      }
      alert('Agent deleted successfully.');
      // Refresh all agents and stats
      await refreshAgentsAndStats();
    } catch (e) {
      console.error('Failed to delete agent', e);
      alert('Failed to delete agent');
    }
  };

  const handleRequestScreenshot = async (agent: any) => {
    if (!confirm(`Request a screenshot from ${agent.name || agent.email}?`)) return;

    try {
      setScreenshotLoading(true);
      setScreenshotResult(null);
      const resp = await (adminAPI as any).requestAgentScreenshot(agent.id);
      const request = resp.data?.request;
      setScreenshotRequestId(request?.requestId || null);
      if (!request?.requestId) {
        alert('Screenshot request could not be created');
      }
    } catch (e) {
      console.error('Failed to request screenshot', e);
      alert('Failed to request screenshot');
    } finally {
      setScreenshotLoading(false);
    }
  };

  const handleExportSpreadsheet = async () => {
    try {
      const resp = await (adminAPI as any).exportLeadsSpreadsheet();
      const blob = new Blob([resp.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `tripnexus-leads-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export leads spreadsheet', error);
      alert('Failed to export leads spreadsheet');
    }
  };

  const handleResetPassword = async (agentId: string) => {
    if (!confirm('Generate a temporary password for this agent?')) return;
    try {
      const resp = await (adminAPI as any).resetAgentPassword(agentId);
      const temp = resp.data?.tempPassword;
      alert('Temporary password: ' + temp + '\nShare it securely with the agent.');
    } catch (e) {
      console.error('Failed to reset password', e);
      alert('Failed to reset password');
    }
  };

  const formatAgentTime = (value?: string | null) => {
    if (!value) return '—';
    try {
      return formatKarachiDateTime(value);
    } catch {
      return value;
    }
  };

  const overviewAgentsById = useMemo(() => {
    const map: Record<string, AdminOverviewAgent> = {};
    for (const agent of adminOverview?.agents || []) {
      map[agent.id] = agent;
    }
    return map;
  }, [adminOverview]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h1 className="text-3xl font-bold">Analytics</h1>
        {isAdmin && (
          <Button size="sm" variant="secondary" onClick={handleExportSpreadsheet}>
            Download Leads Spreadsheet
          </Button>
        )}
      </div>

      {error && (
        <Card>
          <p className="text-red-600 dark:text-red-300">{error}</p>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Object.entries(totals).map(([status, count]) => (
          <Card key={status}>
            <p className="text-sm text-slate-600 dark:text-slate-400 capitalize">{status} Leads</p>
            <p className="text-3xl font-bold">{count}</p>
          </Card>
        ))}

        {Object.keys(totals).length === 0 && (
          <Card>
            <p className="text-sm text-slate-600 dark:text-slate-400">Pipeline Leads</p>
            <p className="text-3xl font-bold">0</p>
          </Card>
        )}
      </div>

      <Card>
        <h2 className="text-xl font-bold mb-4">Pipeline Breakdown</h2>

        {pipeline.length === 0 ? (
          <p className="text-slate-600 dark:text-slate-400">No pipeline data available yet.</p>
        ) : (
          <div className="space-y-3">
            {pipeline.map((row, index) => (
              <div
                key={`${row.status}-${row.temperature}-${index}`}
                className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2"
              >
                <div>
                  <p className="font-medium capitalize">{row.status}</p>
                  <p className="text-sm text-slate-600 dark:text-slate-400 capitalize">{row.temperature} temperature</p>
                </div>
                <p className="text-xl font-bold">{Number(row.count || 0)}</p>
              </div>
            ))}
          </div>
        )}
      </Card>

      {isAdmin && analytics && (
        <Card>
          <h2 className="text-xl font-bold mb-4">Global Performance (Admin)</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Hot Leads</p>
              <p className="text-2xl font-bold">{Number(analytics.hot_leads || 0)}</p>
            </div>
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Warm Leads</p>
              <p className="text-2xl font-bold">{Number(analytics.warm_leads || 0)}</p>
            </div>
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Cold Leads</p>
              <p className="text-2xl font-bold">{Number(analytics.cold_leads || 0)}</p>
            </div>
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Dead Leads</p>
              <p className="text-2xl font-bold">{Number(analytics.dead_leads || 0)}</p>
            </div>
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Avg Budget</p>
              <p className="text-2xl font-bold">{formatCurrency(Number(analytics.avg_budget || 0))}</p>
            </div>
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Active Agents</p>
              <p className="text-2xl font-bold">{Number(analytics.total_agents || 0)}</p>
            </div>
          </div>
        </Card>
      )}

      {isAdmin && adminOverview && (
        <Card>
          <h2 className="text-xl font-bold mb-4">Admin Snapshot</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Today Leads</p>
              <p className="text-2xl font-bold">{adminOverview.summary.todayLeads}</p>
            </div>
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Total Leads</p>
              <p className="text-2xl font-bold">{adminOverview.summary.totalLeads}</p>
            </div>
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Canceled Leads</p>
              <p className="text-2xl font-bold">{adminOverview.summary.canceledLeads}</p>
            </div>
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Canceled Follow-ups</p>
              <p className="text-2xl font-bold">{adminOverview.summary.canceledFollowUps}</p>
            </div>
          </div>
        </Card>
      )}

      {isAdmin && adminOverview && (
        <Card>
          <h2 className="text-xl font-bold mb-4">Canceled Leads</h2>
          {adminOverview.canceledLeads.length === 0 ? (
            <p className="text-sm text-slate-600 dark:text-slate-400">No canceled leads yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left border-b border-slate-200 dark:border-slate-700">
                    <th className="py-2 pr-4">Lead</th>
                    <th className="py-2 pr-4">Agent</th>
                    <th className="py-2 pr-4">Canceled By</th>
                    <th className="py-2 pr-4">Reason</th>
                    <th className="py-2 pr-4">Canceled At</th>
                  </tr>
                </thead>
                <tbody>
                  {adminOverview.canceledLeads.map((lead) => (
                    <tr key={lead.id} className="border-b border-slate-100 dark:border-slate-800 align-top">
                      <td className="py-3 pr-4">
                        <p className="font-medium">{lead.client_name}</p>
                        <p className="text-xs text-slate-500">{lead.email}</p>
                        <p className="text-xs text-slate-400">{lead.destination}</p>
                      </td>
                      <td className="py-3 pr-4">
                        <p className="font-medium">{lead.agent_name}</p>
                        <p className="text-xs text-slate-500">{lead.agent_email}</p>
                      </td>
                      <td className="py-3 pr-4">
                        <p className="font-medium">{lead.canceled_by_name || '—'}</p>
                        <p className="text-xs text-slate-500">{lead.canceled_by_email || '—'}</p>
                      </td>
                      <td className="py-3 pr-4 max-w-xs">{lead.canceled_reason || '—'}</td>
                      <td className="py-3 pr-4">{lead.canceled_at ? formatKarachiDateTime(lead.canceled_at) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {isAdmin && adminOverview && (
        <Card>
          <h2 className="text-xl font-bold mb-4">Canceled Follow-ups</h2>
          {adminOverview.canceledFollowUps.length === 0 ? (
            <p className="text-sm text-slate-600 dark:text-slate-400">No canceled follow-ups yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left border-b border-slate-200 dark:border-slate-700">
                    <th className="py-2 pr-4">Follow-up</th>
                    <th className="py-2 pr-4">Lead / Agent</th>
                    <th className="py-2 pr-4">Canceled By</th>
                    <th className="py-2 pr-4">Reason</th>
                    <th className="py-2 pr-4">Canceled At</th>
                  </tr>
                </thead>
                <tbody>
                  {adminOverview.canceledFollowUps.map((item) => (
                    <tr key={item.id} className="border-b border-slate-100 dark:border-slate-800 align-top">
                      <td className="py-3 pr-4">
                        <p className="font-medium">{item.title}</p>
                        <p className="text-xs text-slate-500">{item.description || '—'}</p>
                      </td>
                      <td className="py-3 pr-4">
                        <p className="font-medium">{item.client_name}</p>
                        <p className="text-xs text-slate-500">{item.agent_name}</p>
                        <p className="text-xs text-slate-400">{item.agent_email}</p>
                      </td>
                      <td className="py-3 pr-4">
                        <p className="font-medium">{item.canceled_by_name || '—'}</p>
                        <p className="text-xs text-slate-500">{item.canceled_by_email || '—'}</p>
                      </td>
                      <td className="py-3 pr-4 max-w-xs">{item.canceled_reason || '—'}</td>
                      <td className="py-3 pr-4">{item.canceled_at ? formatKarachiDateTime(item.canceled_at) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {isAdmin && (
        <Card>
          <h2 className="text-xl font-bold mb-4">Users</h2>
          <div className="flex justify-end mb-3">
            <Button size="sm" onClick={() => setNewAgentOpen(true)}>New User</Button>
          </div>
          <div className="space-y-2">
            {agents.length === 0 && <p className="text-sm text-slate-600">No agents yet.</p>}
            {agents.map((a) => (
              <div key={a.id} className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{a.name || '—'}</p>
                  <p className="text-sm text-slate-500">{a.email}</p>
                  <p className="text-xs text-slate-400">Role: {a.role || 'agent'}</p>
                  {overviewAgentsById[a.id] && (
                    <p className="text-xs text-slate-400">
                      Today: {Number(overviewAgentsById[a.id].today_leads || 0)} ·
                      Total: {Number(overviewAgentsById[a.id].total_leads || 0)} ·
                      Canceled Leads: {Number(overviewAgentsById[a.id].canceled_leads || 0)} ·
                      Canceled Follow-ups: {Number(overviewAgentsById[a.id].canceled_followups || 0)}
                    </p>
                  )}
                  {overviewAgentsById[a.id] && (
                    <p className="text-xs text-slate-400">
                      Last login: {formatAgentTime(overviewAgentsById[a.id].last_login_at)} ·
                      Last logout: {formatAgentTime(overviewAgentsById[a.id].last_logout_at)}
                    </p>
                  )}
                  {agentStats[a.id] && (
                    <p className="text-xs text-slate-400">Follow-ups: {agentStats[a.id].total} — Overdue: {agentStats[a.id].overdue}</p>
                  )}
                  {agentRevenue[a.id] && (
                    <p className="text-xs text-slate-400">Revenue: {formatCurrency(Number(agentRevenue[a.id].total_revenue || agentRevenue[a.id].total_revenue || 0))} • Bookings: {agentRevenue[a.id].bookings}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => handleViewAgent(a)}>View Activity</Button>
                  <Button size="sm" variant="secondary" onClick={() => handleEditAgent(a)}>Edit</Button>
                  <Button size="sm" variant="danger" onClick={() => handleDeleteAgent(a)}>Delete</Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {isAdmin && adminOverview && (
        <Card>
          <h2 className="text-xl font-bold mb-4">Leads by Agent</h2>
          {adminOverview.leads.length === 0 ? (
            <p className="text-sm text-slate-600 dark:text-slate-400">No leads available yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left border-b border-slate-200 dark:border-slate-700">
                    <th className="py-2 pr-4">Lead</th>
                    <th className="py-2 pr-4">Agent</th>
                    <th className="py-2 pr-4">Destination</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-4">Temperature</th>
                    <th className="py-2 pr-4">Created</th>
                    <th className="py-2 pr-4">Canceled Follow-ups</th>
                  </tr>
                </thead>
                <tbody>
                  {adminOverview.leads.map((lead) => (
                    <tr key={lead.id} className="border-b border-slate-100 dark:border-slate-800 align-top">
                      <td className="py-3 pr-4">
                        <p className="font-medium">{lead.client_name || '—'}</p>
                        <p className="text-xs text-slate-500">{lead.email}</p>
                        <p className="text-xs text-slate-400">{lead.phone}</p>
                      </td>
                      <td className="py-3 pr-4">
                        <p className="font-medium">{lead.agent_name || '—'}</p>
                        <p className="text-xs text-slate-500">{lead.agent_email}</p>
                      </td>
                      <td className="py-3 pr-4">{lead.destination || '—'}</td>
                      <td className="py-3 pr-4 capitalize">{lead.status}</td>
                      <td className="py-3 pr-4 capitalize">{lead.temperature}</td>
                      <td className="py-3 pr-4">{formatAgentTime(lead.created_at)}</td>
                      <td className="py-3 pr-4">{Number(lead.canceled_followups || 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

        {/* New Agent modal */}
        {newAgentOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold">Create New User</h3>
                <Button size="sm" onClick={() => setNewAgentOpen(false)}>Close</Button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Email</label>
                  <input type="text" value={newAgentEmail} onChange={e => setNewAgentEmail(e.target.value)} className="input-field w-full" placeholder="sameer@hodophile,pk" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Name</label>
                  <input type="text" value={newAgentName} onChange={e => setNewAgentName(e.target.value)} className="input-field w-full" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Password</label>
                  <input type="password" value={newAgentPassword} onChange={e => setNewAgentPassword(e.target.value)} className="input-field w-full" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Role</label>
                  <select value={newAgentRole} onChange={e => setNewAgentRole(e.target.value)} className="input-field w-full">
                    <option value="agent">Agent</option>
                    <option value="manager">Manager</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="secondary" onClick={() => setNewAgentOpen(false)}>Cancel</Button>
                  <Button size="sm" onClick={async () => {
                    if (!newAgentEmail || !newAgentPassword) { alert('Email and password required'); return; }
                    try {
                      await (adminAPI as any).createAgent({ email: newAgentEmail.trim(), name: newAgentName.trim(), password: newAgentPassword, role: newAgentRole });
                      alert('User created');
                      setNewAgentOpen(false);
                      setNewAgentEmail(''); setNewAgentName(''); setNewAgentPassword(''); setNewAgentRole('agent');
                      // refresh list
                      await refreshAgentsAndStats();
                    } catch (err) {
                      console.error('Failed to create agent', err);
                      alert('Failed to create agent');
                    }
                  }}>Create</Button>
                </div>
              </div>
            </div>
          </div>
        )}

      {/* Agent modal */}
      {selectedAgent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-3xl bg-white dark:bg-slate-900 rounded-lg p-6">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold">Agent: {selectedAgent.name || selectedAgent.email}</h3>
                <p className="text-sm text-slate-500">{selectedAgent.email}</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="danger" onClick={() => handleResetPassword(selectedAgent.id)}>Reset Password</Button>
                <Button size="sm" variant="secondary" onClick={() => handleRequestScreenshot(selectedAgent)} loading={screenshotLoading}>
                  Request Screenshot
                </Button>
                <Button size="sm" onClick={() => { setSelectedAgent(null); setAgentLeads([]); }}>Close</Button>
              </div>
            </div>

            {screenshotRequestId && (
              <div className="mt-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-3 text-sm text-slate-600 dark:text-slate-300">
                Waiting for screenshot from {selectedAgent.name || selectedAgent.email}...
              </div>
            )}

            {screenshotResult && screenshotResult.agentId === selectedAgent.id && (
              <div className="mt-4 rounded-lg border border-slate-200 dark:border-slate-700 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h4 className="font-semibold">Latest Screenshot</h4>
                    <p className="text-xs text-slate-500">
                      {screenshotResult.capturedAt ? formatKarachiDateTime(screenshotResult.capturedAt) : 'Just received'}
                    </p>
                    {screenshotResult.screenshot?.expires_at && (
                      <p className="text-xs text-slate-400">
                        Expires: {formatKarachiDateTime(screenshotResult.screenshot.expires_at)}
                      </p>
                    )}
                  </div>
                  <Button size="sm" variant="secondary" onClick={() => setScreenshotResult(null)}>Clear</Button>
                </div>
                {screenshotResult.error ? (
                  <p className="mt-3 text-sm text-rose-600">{screenshotResult.error}</p>
                ) : (
                  <img
                    src={screenshotResult.screenshot?.url || ''}
                    alt={`Screenshot from ${selectedAgent.name || selectedAgent.email}`}
                    className="mt-3 w-full rounded-lg border border-slate-200 dark:border-slate-700"
                  />
                )}
              </div>
            )}

            <div className="mt-4">
              {loadingAgentLeads ? (
                <Spinner />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <h4 className="font-semibold">Cold Leads</h4>
                    {agentLeads.filter(l => l.temperature === 'cold').map(l => (
                      <div key={l.id} className="p-2 border rounded my-2">
                        <p className="font-medium">{l.clientName || '—'}</p>
                        <p className="text-sm text-slate-500">{l.email}</p>
                      </div>
                    ))}
                  </div>
                  <div>
                    <h4 className="font-semibold">Potential Leads</h4>
                    {agentLeads.filter(l => l.potential).map(l => (
                      <div key={l.id} className="p-2 border rounded my-2">
                        <p className="font-medium">{l.clientName || '—'}</p>
                        <p className="text-sm text-slate-500">{l.email}</p>
                      </div>
                    ))}
                  </div>
                  <div>
                    <h4 className="font-semibold">Confirmed Leads</h4>
                    {agentLeads.filter(l => l.pipelineStage === 'confirmed' || l.status === 'booked').map(l => (
                      <div key={l.id} className="p-2 border rounded my-2">
                        <p className="font-medium">{l.clientName || '—'}</p>
                        <p className="text-sm text-slate-500">{l.email}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
