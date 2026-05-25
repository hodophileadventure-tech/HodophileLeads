import React, { useEffect, useMemo, useState } from 'react';
import { Card, Spinner, Button } from './common';
import { dashboardAPI, adminAPI } from '../utils/api-service';
import type { Lead } from '../types';
import { formatCurrency } from '../utils/helpers';

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

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ isAdmin }) => {
  const [pipeline, setPipeline] = useState<PipelineRow[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [agents, setAgents] = useState<any[]>([]);
  const [agentStats, setAgentStats] = useState<Record<string, any>>({});
  const [agentRevenue, setAgentRevenue] = useState<Record<string, any>>({});
  const [newAgentOpen, setNewAgentOpen] = useState(false);
  const [newAgentEmail, setNewAgentEmail] = useState('');
  const [newAgentName, setNewAgentName] = useState('');
  const [newAgentPassword, setNewAgentPassword] = useState('');
  const [newAgentRole, setNewAgentRole] = useState('agent');
  const [selectedAgent, setSelectedAgent] = useState<any | null>(null);
  const [agentLeads, setAgentLeads] = useState<Lead[]>([]);
  const [loadingAgentLeads, setLoadingAgentLeads] = useState(false);

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
    } catch (e) {
      console.error('Failed to load agents', e);
    }
  };

  useEffect(() => {
    if (!isAdmin) return;
    refreshAgentsAndStats();
  }, [isAdmin]);

  const handleViewAgent = async (agent: any) => {
    setSelectedAgent(agent);
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

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Analytics</h1>

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

      {isAdmin && (
        <Card>
          <h2 className="text-xl font-bold mb-4">Agents</h2>
          <div className="flex justify-end mb-3">
            <Button size="sm" onClick={() => setNewAgentOpen(true)}>New Agent</Button>
          </div>
          <div className="space-y-2">
            {agents.length === 0 && <p className="text-sm text-slate-600">No agents yet.</p>}
            {agents.map((a) => (
              <div key={a.id} className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{a.name || '—'}</p>
                  <p className="text-sm text-slate-500">{a.email}</p>
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
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

        {/* New Agent modal */}
        {newAgentOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold">Create New Agent</h3>
                <Button size="sm" onClick={() => setNewAgentOpen(false)}>Close</Button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Email</label>
                  <input type="email" value={newAgentEmail} onChange={e => setNewAgentEmail(e.target.value)} className="input-field w-full" />
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
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="secondary" onClick={() => setNewAgentOpen(false)}>Cancel</Button>
                  <Button size="sm" onClick={async () => {
                    if (!newAgentEmail || !newAgentPassword) { alert('Email and password required'); return; }
                    try {
                      await (adminAPI as any).createAgent({ email: newAgentEmail, name: newAgentName, password: newAgentPassword, role: newAgentRole });
                      alert('Agent created');
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
                <Button size="sm" onClick={() => { setSelectedAgent(null); setAgentLeads([]); }}>Close</Button>
              </div>
            </div>

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
