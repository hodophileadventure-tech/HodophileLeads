import React, { useEffect, useMemo, useState } from 'react';
import { Activity, AlertCircle, ArrowRight, Bell, CheckCircle2, CircleDollarSign, Flame, RefreshCw, Users } from 'lucide-react';
import { dashboardAPI } from '../utils/api-service';
import { formatCurrency } from '../utils/helpers';
import { Spinner } from './common';
import { useAuth } from '../context/AuthContext';
import { useDataStore } from '../context/store';

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
  const { leads, followUps } = useDataStore();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [pipeline, setPipeline] = useState<PipelineRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState('');

  const fetchDashboard = async (showLoader = false) => {
    if (showLoader) setRefreshing(true);
    const [statsResult, pipelineResult] = await Promise.allSettled([dashboardAPI.getStats(), dashboardAPI.getPipeline()]);
    if (statsResult.status === 'fulfilled') setStats(statsResult.value.data || {});
    if (pipelineResult.status === 'fulfilled') setPipeline(Array.isArray(pipelineResult.value.data) ? pipelineResult.value.data : []);
    if (statsResult.status === 'rejected' && pipelineResult.status === 'rejected') setError('Dashboard data is temporarily unavailable.');
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
  }, []);

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
  const kpis = [
    { label: 'Total leads', value: stats?.totalLeads || 0, detail: 'Current portfolio', icon: Users, action: 'leads' as const },
    { label: 'Hot leads', value: stats?.hotLeads || 0, detail: 'Priority conversations', icon: Flame, action: 'leads' as const },
    { label: 'Follow-ups due', value: followUpCounts.today + followUpCounts.overdue, detail: `${followUpCounts.overdue} overdue`, icon: Bell, action: 'followups' as const },
    { label: 'Confirmed bookings', value: stats?.totalConfirmed || stats?.bookingsThisMonth || 0, detail: 'All confirmed', icon: CheckCircle2, action: 'analytics' as const },
    { label: 'Confirmed revenue', value: formatCurrency(stats?.totalRevenue || 0), detail: 'From confirmed leads', icon: CircleDollarSign, action: 'analytics' as const }
  ];

  if (loading) return <div className="dashboard-skeleton" aria-label="Loading dashboard"><Spinner size="lg" /></div>;

  return (
    <div className="dashboard-command-center space-y-5">
      <header className="flex flex-col gap-4 border-b border-[var(--line)] pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div><p className="text-xs font-bold uppercase tracking-[.16em] text-amber-600">Executive overview</p><h1 className="mt-1 text-3xl font-bold text-[var(--text)]">Dashboard</h1><p className="mt-1 text-sm text-[var(--muted)]">Sales and operations overview for {user?.name || 'your team'}.</p></div>
        <div className="flex flex-wrap items-center gap-2"><span className="dashboard-live-status"><span className="dashboard-live-dot" /> Live</span><span className="text-xs text-slate-500">{lastUpdated ? `Updated ${formatUpdated(lastUpdated)}` : 'Updating...'}</span><button type="button" onClick={() => void fetchDashboard(true)} className="rounded-md border border-[var(--line)] bg-white p-2 text-slate-500 hover:bg-slate-50" title="Refresh dashboard" aria-label="Refresh dashboard"><RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} /></button></div>
      </header>
      {error && <div className="flex items-center justify-between gap-3 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"><span>{error}</span><button type="button" onClick={() => void fetchDashboard(true)} className="font-semibold underline">Retry</button></div>}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5" aria-label="Key performance indicators">
        {kpis.map(({ label, value, detail, icon: Icon, action }) => <button key={label} type="button" onClick={() => onNavigate?.(action)} className="dashboard-kpi text-left"><div className="flex items-start justify-between gap-3"><span className="dashboard-kpi-icon"><Icon size={17} /></span><ArrowRight size={14} className="text-slate-300" /></div><p className="mt-4 text-[.68rem] font-bold uppercase tracking-[.12em] text-slate-500">{label}</p><p className="mt-1 truncate font-display text-2xl font-bold text-[var(--text)]">{value}</p><p className="mt-1 text-xs text-slate-500">{detail}</p></button>)}
      </section>
      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.25fr_.75fr]">
        <div className="dashboard-section"><div className="flex items-start justify-between gap-4"><div><p className="section-eyebrow">Pipeline intelligence</p><h2 className="section-title">Where leads are moving</h2></div><span className="text-xs font-semibold text-slate-500">Live count</span></div><div className="mt-6 space-y-5">{pipelineSummary.map((stage) => <button key={stage.label} type="button" onClick={() => onNavigate?.('leads')} className="group grid w-full grid-cols-[6.5rem_1fr_2rem] items-center gap-3 text-left"><span className="text-sm font-medium text-slate-600 group-hover:text-slate-900">{stage.label}</span><span className="h-2 overflow-hidden rounded-full bg-slate-100"><span className={`block h-full rounded-full ${stage.tone} transition-all duration-500`} style={{ width: `${stage.percent}%` }} /></span><span className="text-right text-xs font-bold text-slate-700">{stage.count}</span></button>)}</div></div>
        <div className="dashboard-section dashboard-priority"><div className="flex items-start justify-between gap-4"><div><p className="section-eyebrow">Action center</p><h2 className="section-title">What needs attention</h2></div><AlertCircle size={18} className="text-amber-600" /></div><div className="mt-3 divide-y divide-amber-200/70"><button type="button" onClick={() => onNavigate?.('followups')} className="dashboard-action-row"><span><strong>{followUpCounts.overdue}</strong> overdue follow-ups</span><ArrowRight size={15} /></button><button type="button" onClick={() => onNavigate?.('followups')} className="dashboard-action-row"><span><strong>{followUpCounts.today}</strong> follow-ups due today</span><ArrowRight size={15} /></button><button type="button" onClick={() => onNavigate?.('leads')} className="dashboard-action-row"><span><strong>{hotWithoutFollowUp}</strong> hot leads without follow-up</span><ArrowRight size={15} /></button><div className="dashboard-action-row"><span><strong>{stats?.pendingPayments || 0}</strong> payments pending</span><Activity size={15} /></div></div></div>
      </section>
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3"><div className="dashboard-section lg:col-span-2"><div className="flex items-start justify-between gap-4"><div><p className="section-eyebrow">Revenue target</p><h2 className="section-title">Confirmed revenue progress</h2></div><span className="text-xs font-semibold text-slate-500">Current snapshot</span></div><div className="mt-6 flex items-end justify-between gap-4"><div><p className="font-display text-3xl font-bold text-[var(--text)]">{formatCurrency(stats?.totalRevenue || 0)}</p><p className="mt-1 text-xs text-slate-500">of {formatCurrency(stats?.monthlyTarget || 0)} target</p></div><span className="font-display text-xl font-bold text-amber-600">{stats?.monthlyTargetProgress || 0}%</span></div><div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-amber-400 transition-all duration-700" style={{ width: `${Math.min(100, stats?.monthlyTargetProgress || 0)}%` }} /></div><p className="mt-3 text-xs text-slate-500">Historical revenue trend is not exposed by the current dashboard API.</p></div><div className="dashboard-section"><p className="section-eyebrow">Operational health</p><h2 className="section-title">Follow-up performance</h2><div className="mt-6 grid grid-cols-2 gap-4"><div><p className="font-display text-2xl font-bold text-rose-600">{followUpCounts.overdue}</p><p className="text-xs text-slate-500">Overdue</p></div><div><p className="font-display text-2xl font-bold text-amber-600">{followUpCounts.today}</p><p className="text-xs text-slate-500">Due today</p></div></div><button type="button" onClick={() => onNavigate?.('followups')} className="mt-6 flex items-center gap-2 text-xs font-bold text-amber-700 hover:text-amber-800">Open follow-ups <ArrowRight size={14} /></button></div></section>
    </div>
  );
};