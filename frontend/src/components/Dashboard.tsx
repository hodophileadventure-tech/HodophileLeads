import React, { useEffect, useMemo, useState } from 'react';
import { Bell, CheckCircle2, CircleDollarSign, Flame, RefreshCw, Users } from 'lucide-react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { dashboardAPI, followUpsAPI, leadsAPI } from '../utils/api-service';
import { formatCurrency } from '../utils/helpers';
import { Spinner } from './common';
import { useAuth } from '../context/AuthContext';
import { useDataStore } from '../context/store';
import { normalizeFollowUp } from '../utils/followup-utils';

interface DashboardProps { onNavigate?: (page: 'leads' | 'followups' | 'analytics') => void; }
interface DashboardStats { totalLeads?: number; hotLeads?: number; totalConfirmed?: number; bookingsThisMonth?: number; totalRevenue?: number; pendingPayments?: number; monthlyTarget?: number; monthlyTargetProgress?: number; }
interface PipelineRow { status?: string; count?: number | string; }

const statusGroups = [
  { label: 'New', statuses: ['new'], tone: 'bg-sky-500' },
  { label: 'Contacted', statuses: ['contacted'], tone: 'bg-cyan-500' },
  { label: 'Follow-up', statuses: ['interested', 'negotiation'], tone: 'bg-amber-400' },
  { label: 'Confirmed', statuses: ['booked', 'completed'], tone: 'bg-emerald-500' },
  { label: 'Cancelled', statuses: ['canceled'], tone: 'bg-rose-500' }
];

const formatUpdated = (date: Date) => date.toLocaleTimeString('en-PK', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true });

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const { leads, followUps, setLeads, setFollowUps } = useDataStore();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [pipeline, setPipeline] = useState<PipelineRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState('');

  const fetchDashboard = async (showLoader = false) => {
    if (showLoader) setRefreshing(true);
    const [statsResult, pipelineResult, leadsResult, followUpsResult] = await Promise.allSettled([
      dashboardAPI.getStats(), dashboardAPI.getPipeline(), leadsAPI.list(100, undefined, 0), followUpsAPI.list()
    ]);
    if (statsResult.status === 'fulfilled') setStats(statsResult.value.data || {});
    if (pipelineResult.status === 'fulfilled') setPipeline(Array.isArray(pipelineResult.value.data) ? pipelineResult.value.data : []);
    if (leadsResult.status === 'fulfilled') setLeads(leadsResult.value.data || []);
    if (followUpsResult.status === 'fulfilled') setFollowUps((followUpsResult.value.data || []).map(normalizeFollowUp));
    if (statsResult.status === 'rejected' && pipelineResult.status === 'rejected' && leadsResult.status === 'rejected' && followUpsResult.status === 'rejected') setError('Dashboard data is temporarily unavailable.');
    else { setError(''); setLastUpdated(new Date()); }
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    void fetchDashboard();
    const refresh = () => { if (document.visibilityState === 'visible') void fetchDashboard(); };
    const interval = window.setInterval(refresh, 30000);
    window.addEventListener('dashboard-refresh', refresh);
    return () => { window.clearInterval(interval); window.removeEventListener('dashboard-refresh', refresh); };
  }, [setFollowUps, setLeads]);

  const followUpCounts = useMemo(() => {
    const todayKey = new Date().toDateString();
    return followUps.reduce((result, item) => {
      if (item.status === 'completed' || item.status === 'canceled') return result;
      const due = new Date(item.dueDate);
      if (Number.isNaN(due.getTime()) || due < new Date()) result.overdue += 1;
      else if (due.toDateString() === todayKey) result.today += 1;
      return result;
    }, { today: 0, overdue: 0 });
  }, [followUps]);

  const pipelineSummary = useMemo(() => {
    const total = pipeline.reduce((sum, row) => sum + Number(row.count || 0), 0);
    return statusGroups.map((group) => {
      const count = pipeline.filter((row) => group.statuses.includes(String(row.status || '').toLowerCase())).reduce((sum, row) => sum + Number(row.count || 0), 0);
      return { ...group, count, percent: total ? Math.round((count / total) * 100) : 0 };
    });
  }, [pipeline]);

  const hotWithoutFollowUp = useMemo(() => leads.filter((lead) => lead.temperature === 'hot' && !followUps.some((item) => String(item.leadId) === String(lead.id) && item.status !== 'completed' && item.status !== 'canceled')).length, [leads, followUps]);
  const trendData = useMemo(() => {
    const days = Array.from({ length: 14 }, (_, index) => {
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - (13 - index));
      return { key: date.toISOString().slice(0, 10), label: date.toLocaleDateString('en-PK', { day: 'numeric', month: 'short' }), leads: 0, followUps: 0 };
    });
    const byDate = new Map(days.map((day) => [day.key, day]));
    leads.forEach((lead) => {
      const date = new Date(lead.createdAt);
      if (Number.isNaN(date.getTime())) return;
      const key = date.toISOString().slice(0, 10);
      const day = byDate.get(key);
      if (day) day.leads += 1;
    });
    followUps.forEach((item) => {
      const date = new Date(item.createdAt);
      if (Number.isNaN(date.getTime())) return;
      const key = date.toISOString().slice(0, 10);
      const day = byDate.get(key);
      if (day) day.followUps += 1;
    });
    return days;
  }, [leads, followUps]);
  const kpis = [
    { label: 'Total leads', value: stats?.totalLeads || 0, detail: 'Current portfolio', icon: Users, action: 'leads' as const },
    { label: 'Hot leads', value: stats?.hotLeads || 0, detail: 'Priority conversations', icon: Flame, action: 'leads' as const },
    { label: 'Follow-ups due', value: followUpCounts.today + followUpCounts.overdue, detail: `${followUpCounts.overdue} overdue`, icon: Bell, action: 'followups' as const },
    { label: 'Confirmed bookings', value: stats?.totalConfirmed || stats?.bookingsThisMonth || 0, detail: 'All confirmed', icon: CheckCircle2, action: 'analytics' as const },
    { label: 'Confirmed revenue', value: formatCurrency(stats?.totalRevenue || 0), detail: 'From confirmed leads', icon: CircleDollarSign, action: 'analytics' as const }
  ];

  if (loading) return <div className="dashboard-skeleton" aria-label="Loading dashboard"><Spinner size="lg" /></div>;

  return (
    <div className="dashboard-command-center space-y-6">
      {/* Premium Header */}
      <header className="rounded-xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-6 text-white shadow-lg">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-amber-400 mb-2">📊 Real-Time Intelligence</p>
            <h1 className="text-4xl font-bold mb-2">Executive Dashboard</h1>
            <p className="text-slate-300 max-w-2xl">Sales and operations overview for <span className="font-semibold">{user?.name || 'your team'}</span></p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center gap-2 rounded-lg bg-white/10 backdrop-blur border border-white/20 px-3 py-2">
              <span className="dashboard-live-dot" />
              <span className="text-sm font-semibold">Live</span>
            </div>
            {lastUpdated && (
              <span className="text-xs text-slate-300">Updated {formatUpdated(lastUpdated)}</span>
            )}
            <button 
              type="button" 
              onClick={() => void fetchDashboard(true)} 
              className="rounded-lg bg-amber-500 hover:bg-amber-600 p-2 text-white transition-colors shadow-md" 
              title="Refresh dashboard" 
              aria-label="Refresh dashboard"
            >
              <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      </header>

      {error && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 shadow-sm">
          <span>⚠️ {error}</span>
          <button type="button" onClick={() => void fetchDashboard(true)} className="font-semibold underline hover:text-red-900">
            Retry
          </button>
        </div>
      )}

      {/* KPIs Section */}
      <section className="premium-kpi-grid" aria-label="Key performance indicators">
        {kpis.map(({ label, value, detail, icon: Icon, action }) => (
          <button
            key={label}
            type="button"
            onClick={() => onNavigate?.(action)}
            className="premium-kpi-card"
          >
            <div className="premium-kpi-card-icon">
              <Icon size={20} />
            </div>
            <p className="premium-kpi-card-label">{label}</p>
            <p className="premium-kpi-card-value">{value}</p>
            <p className="premium-kpi-card-detail">{detail}</p>
          </button>
        ))}
      </section>

      {/* Main Sections */}
      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.25fr_.75fr]">
        {/* Pipeline Section */}
        <div className="premium-section">
          <h2>📊 Pipeline Intelligence</h2>
          <p className="text-sm text-slate-600 mb-4">Where leads are moving</p>
          <div className="space-y-4">
            {pipelineSummary.map((stage) => (
              <button
                key={stage.label}
                type="button"
                onClick={() => onNavigate?.('leads')}
                className="group grid w-full grid-cols-[6rem_1fr_3rem] items-center gap-3 text-left hover:opacity-80 transition-opacity"
              >
                <span className="text-sm font-semibold text-slate-700 group-hover:text-slate-900">{stage.label}</span>
                <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className={`h-full rounded-full ${stage.tone} transition-all duration-500`}
                    style={{ width: `${stage.percent}%` }}
                  />
                </div>
                <span className="text-right text-sm font-bold text-slate-900">{stage.count}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Action Center */}
        <div className="premium-section">
          <h2>⚡ Action Center</h2>
          <p className="text-sm text-slate-600 mb-4">What needs your attention</p>
          <div className="space-y-2">
            <button type="button" onClick={() => onNavigate?.('followups')} className="premium-list-item hover:bg-slate-50 rounded px-2">
              <div className="premium-list-item-content">
                <p className="premium-list-item-title">⏰ Overdue Follow-ups</p>
                <p className="premium-list-item-subtitle"><strong className="text-red-600">{followUpCounts.overdue}</strong> follow-ups need action</p>
              </div>
              <span className="premium-badge danger">{followUpCounts.overdue}</span>
            </button>
            <button type="button" onClick={() => onNavigate?.('followups')} className="premium-list-item hover:bg-slate-50 rounded px-2">
              <div className="premium-list-item-content">
                <p className="premium-list-item-title">📍 Due Today</p>
                <p className="premium-list-item-subtitle"><strong className="text-green-600">{followUpCounts.today}</strong> tasks scheduled for today</p>
              </div>
              <span className="premium-badge success">{followUpCounts.today}</span>
            </button>
            <button type="button" onClick={() => onNavigate?.('leads')} className="premium-list-item hover:bg-slate-50 rounded px-2">
              <div className="premium-list-item-content">
                <p className="premium-list-item-title">🔥 Hot Leads</p>
                <p className="premium-list-item-subtitle"><strong className="text-orange-600">{hotWithoutFollowUp}</strong> hot leads awaiting follow-up</p>
              </div>
              <span className="premium-badge warning">{hotWithoutFollowUp}</span>
            </button>
            <div className="premium-list-item border-b-0">
              <div className="premium-list-item-content">
                <p className="premium-list-item-title">💳 Pending Payments</p>
                <p className="premium-list-item-subtitle"><strong className="text-blue-600">{stats?.pendingPayments || 0}</strong> payments awaiting</p>
              </div>
              <span className="premium-badge info">{stats?.pendingPayments || 0}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Revenue & Performance */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="premium-section lg:col-span-2">
          <h2>💰 Revenue Target</h2>
          <p className="text-sm text-slate-600 mb-4">Confirmed revenue progress</p>
          <div className="flex items-end justify-between gap-4 mb-6">
            <div>
              <p className="text-3xl font-bold text-slate-900">{formatCurrency(stats?.totalRevenue || 0)}</p>
              <p className="mt-1 text-xs text-slate-600">of {formatCurrency(stats?.monthlyTarget || 0)} target</p>
            </div>
            <span className="text-3xl font-bold text-amber-600">{stats?.monthlyTargetProgress || 0}%</span>
          </div>
          <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-500 transition-all duration-700"
              style={{ width: `${Math.min(100, stats?.monthlyTargetProgress || 0)}%` }}
            />
          </div>
          <p className="mt-3 text-xs text-slate-500">Progress based on confirmed bookings this month</p>
        </div>

        {/* Follow-up Health */}
        <div className="premium-section">
          <h2>✓ Operational Health</h2>
          <p className="text-sm text-slate-600 mb-4">Follow-up performance metrics</p>
          <div className="space-y-3">
            <div className="premium-kpi-card">
              <div className="premium-kpi-card-value text-red-600">{followUpCounts.overdue}</div>
              <div className="premium-kpi-card-label">Overdue Tasks</div>
            </div>
            <div className="premium-kpi-card">
              <div className="premium-kpi-card-value text-amber-600">{followUpCounts.today}</div>
              <div className="premium-kpi-card-label">Due Today</div>
            </div>
          </div>
          <button type="button" onClick={() => onNavigate?.('followups')} className="mt-6 w-full premium-action-button primary">
            📋 View All Follow-ups
          </button>
        </div>
      </section>

      {/* Charts Section */}
      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.35fr_.65fr]">
        <div className="premium-section">
          <h2>📈 Live Activity Trend</h2>
          <p className="text-sm text-slate-600 mb-4">Leads and follow-ups over 14 days</p>
          <div className="mt-5 h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <defs><linearGradient id="leadTrendFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#FCC000" stopOpacity={0.32} /><stop offset="100%" stopColor="#FCC000" stopOpacity={0.03} /></linearGradient></defs>
                <CartesianGrid vertical={false} stroke="#e9eef1" strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#7b8790' }} tickLine={false} axisLine={false} interval={2} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#7b8790' }} tickLine={false} axisLine={false} width={28} />
                <Tooltip contentStyle={{ border: '1px solid #dce3e8', borderRadius: 6, fontSize: 12 }} labelStyle={{ fontWeight: 700, color: '#17212b' }} />
                <Area type="monotone" dataKey="leads" name="Leads created" stroke="#d49a00" strokeWidth={2.5} fill="url(#leadTrendFill)" animationDuration={650} />
                <Area type="monotone" dataKey="followUps" name="Follow-ups created" stroke="#45525e" strokeWidth={1.8} fill="none" animationDuration={650} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-xs text-slate-500">Based on records currently available to your workspace. Historical revenue is not exposed by the current API.</p>
        </div>
        <div className="dashboard-section">
          <div><p className="section-eyebrow">Workload trend</p><h2 className="section-title">Follow-ups created</h2></div>
          <div className="mt-5 h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trendData} margin={{ top: 8, right: 0, left: -24, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#e9eef1" strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#7b8790' }} tickLine={false} axisLine={false} interval={3} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#7b8790' }} tickLine={false} axisLine={false} width={28} />
                <Tooltip cursor={{ fill: '#fff8df' }} contentStyle={{ border: '1px solid #dce3e8', borderRadius: 6, fontSize: 12 }} />
                <Bar dataKey="followUps" name="Follow-ups" fill="#45525e" radius={[3, 3, 0, 0]} animationDuration={650} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>
    </div>
  );
};