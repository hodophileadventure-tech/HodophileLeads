import React, { useEffect, useMemo, useState } from 'react';
import { leadsAPI, followUpsAPI } from '../utils/api-service';
import { Button, Badge, Modal } from '../components/common';
import { LeadForm } from '../components/LeadForm';
import ConfirmedLeadForm from '../components/ConfirmedLeadForm';
import { KanbanPipeline } from '../components/KanbanPipeline';
import { LeadList } from '../components/LeadCard';
import PaymentsPanel from '../components/PaymentsPanel';
import type { Lead, FollowUp, PipelineStage } from '../types';
import { 
  formatKarachiDateTime, 
  formatKarachiFollowUpReminder, 
  getLeadLifecycleState
} from '../utils/helpers';


const CANCEL_LEAD_REASONS = [
  'Budget constraints',
  'Change of plans',
  'Work commitments',
  'Leave not approved',
  'Family emergency',
  'Medical issue',
  'Friends/family cancelled',
  'Unexpected expenses',
  'Another agency offered a lower price',
  'Got a better offer from elsewhere',
  'Payment issues',
  'Preferred dates unavailable',
  'Weather concerns',
  'Safety concerns',
  'Visa delay/rejection',
  'Passport/travel document issue',
  'Trip postponed',
  'Not ready to travel',
  'Itinerary not suitable',
  'Changed destination',
  'Low quality Lead',
  'Did tour on their own',
  'No specific reason',
];

type StatusFilter = 'all' | 'active' | 'potential' | 'in_progress' | 'dead' | 'confirmed' | 'cancelled' | 'spam' | 'new';

interface LeadsPageProps {
  leads: Lead[];
  followUps: FollowUp[];
  onRefreshLeads: () => Promise<void>;
  onLoadMoreLeads?: () => Promise<void>;
  onRefreshFollowUps: () => Promise<void>;
}

export const LeadsPage: React.FC<LeadsPageProps> = ({
  leads,
  followUps,
  onRefreshLeads,
  onLoadMoreLeads,
  onRefreshFollowUps,
}) => {
  const [activeFilter, setActiveFilter] = useState<StatusFilter>('all');
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [leadView, setLeadView] = useState<'list' | 'kanban'>('kanban');
  const [leadSearchQuery, setLeadSearchQuery] = useState('');
  const [dateRangeStart, setDateRangeStart] = useState('');
  const [dateRangeEnd, setDateRangeEnd] = useState('');
  const [appliedDateRange, setAppliedDateRange] = useState<{ startDate: string; endDate: string }>({ startDate: '', endDate: '' });
  const [locationFilter, setLocationFilter] = useState('');
  const [travelMonthFilter, setTravelMonthFilter] = useState('');
  const [tourTypeFilters, setTourTypeFilters] = useState<Array<'group' | 'private'>>([]);
  const [showFollowUpModal, setShowFollowUpModal] = useState(false);
  const [followUpTitle, setFollowUpTitle] = useState('Follow up with client');
  const [followUpNote, setFollowUpNote] = useState('');
  const [followUpDateTime, setFollowUpDateTime] = useState('');
  const [editingFollowUp, setEditingFollowUp] = useState<FollowUp | null>(null);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [completionRemarks, setCompletionRemarks] = useState('');
  const [showCancelLeadModal, setShowCancelLeadModal] = useState(false);
  const [cancelLeadReason, setCancelLeadReason] = useState('');
  const [cancelLeadReasonDetail, setCancelLeadReasonDetail] = useState('');
  const [showConfirmForm, setShowConfirmForm] = useState(false);
  const [pipelineCollapsed, setPipelineCollapsed] = useState(false);
  const leadDetailRef = React.useRef<HTMLDivElement | null>(null);
  const followUpModalRef = React.useRef<HTMLDivElement | null>(null);
  const completionModalRef = React.useRef<HTMLDivElement | null>(null);
  // Keep the user in their current viewport instead of auto-jumping down the page
  // when a lead is selected or when follow-up actions are opened.
  // UI now expects the parent to supply the full `leads` list;
  // client-side filtering will be applied for tabs.

  // Filter leads based on status
  const getLeadLocation = (lead: Lead) => {
    if (lead.destination && typeof lead.destination === 'string' && lead.destination.trim()) {
      return lead.destination.trim();
    }
    if (Array.isArray(lead.destinations) && lead.destinations.length > 0) {
      return String(lead.destinations[0]).trim();
    }
    return '';
  };

  const getLeadTravelStart = (lead: Lead): Date | null => {
    const travelDateValue = lead.travelDates?.from || lead.travel_date || '';
    const parsed = new Date(travelDateValue);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const getLeadTravelMonth = (lead: Lead): string => {
    const date = getLeadTravelStart(lead);
    if (!date) return '';
    return date.toLocaleString('en-US', { month: 'long' }).toLowerCase();
  };

  const filteredLeads = useMemo(() => {
    let result = [...leads];

    // Apply status filter
    if (activeFilter !== 'all') {
      result = result.filter((lead) => {
        const lifecycle = getLeadLifecycleState(lead);

        if (activeFilter === 'cancelled') return lifecycle === 'cancelled';
        if (activeFilter === 'spam') return lifecycle === 'spam';
        if (activeFilter === 'active') return lifecycle === 'confirmed' || lifecycle === 'in_progress';
        return lifecycle === activeFilter;
      });
    }

    // Apply search and date range filters
    if (leadSearchQuery || appliedDateRange.startDate || appliedDateRange.endDate) {
      result = result.filter((lead) => {
        let matchesSearch = true;
        let matchesDate = true;

        if (leadSearchQuery) {
          const query = leadSearchQuery.toLowerCase();
          matchesSearch =
            lead.phone.toLowerCase().includes(query) ||
            lead.clientName.toLowerCase().includes(query) ||
            lead.email.toLowerCase().includes(query);
        }

        if (appliedDateRange.startDate || appliedDateRange.endDate) {
          const createdAt = new Date(lead.createdAt || '').getTime();
          const startTime = appliedDateRange.startDate ? new Date(appliedDateRange.startDate).getTime() : 0;
          const endTime = appliedDateRange.endDate ? new Date(appliedDateRange.endDate).getTime() + 24 * 60 * 60 * 1000 : Date.now();
          matchesDate = createdAt >= startTime && createdAt <= endTime;
        }

        return matchesSearch && matchesDate;
      });
    }

    // Apply location filter
    if (locationFilter.trim()) {
      const query = locationFilter.trim().toLowerCase();
      result = result.filter((lead) => getLeadLocation(lead).toLowerCase().includes(query));
    }

    // Apply travel month filter
    if (travelMonthFilter.trim()) {
      const query = travelMonthFilter.trim().toLowerCase();
      result = result.filter((lead) => getLeadTravelMonth(lead).includes(query));
    }

    // Apply tour type filter (group/private)
    if (tourTypeFilters.length > 0) {
      result = result.filter((lead) => {
        const type = String(lead.tourType || '').toLowerCase();
        return tourTypeFilters.includes(type as 'group' | 'private');
      });
    }

    return result;
  }, [leads, activeFilter, leadSearchQuery, appliedDateRange, locationFilter, travelMonthFilter, tourTypeFilters]);

  

  const selectedLeadFollowUps = useMemo(
    () => followUps.filter((fu) => String(fu.leadId) === String(selectedLead?.id)),
    [followUps, selectedLead]
  );

  const nextPendingFollowUp = useMemo(
    () => selectedLeadFollowUps.find((fu) => fu.status === 'upcoming'),
    [selectedLeadFollowUps]
  );

  // Count leads by status
  const statusCounts = useMemo(() => {
    return {
      all: leads.length,
      active: leads.filter((lead) => {
        const lifecycle = getLeadLifecycleState(lead);
        return lifecycle === 'confirmed' || lifecycle === 'in_progress';
      }).length,
      potential: leads.filter((lead) => getLeadLifecycleState(lead) === 'potential').length,
      in_progress: leads.filter((lead) => getLeadLifecycleState(lead) === 'in_progress').length,
      dead: leads.filter((lead) => getLeadLifecycleState(lead) === 'dead').length,
      confirmed: leads.filter((lead) => getLeadLifecycleState(lead) === 'confirmed').length,
      cancelled: leads.filter((lead) => getLeadLifecycleState(lead) === 'cancelled').length,
      spam: leads.filter((lead) => getLeadLifecycleState(lead) === 'spam').length,
      new: leads.filter((lead) => getLeadLifecycleState(lead) === 'new').length,
    };
  }, [leads]);

  // Scroll modals into view when they open
  useEffect(() => {
    if (showFollowUpModal && followUpModalRef.current) {
      followUpModalRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [showFollowUpModal]);

  useEffect(() => {
    if (showCompletionModal && completionModalRef.current) {
      completionModalRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [showCompletionModal]);

  const handleLeadSearch = () => {
    // Search is already applied via useMemo
  };

  const handleApplyLeadFilters = () => {
    setAppliedDateRange({ startDate: dateRangeStart, endDate: dateRangeEnd });
  };

  const handleClearLeadFilters = () => {
    setLeadSearchQuery('');
    setDateRangeStart('');
    setDateRangeEnd('');
    setAppliedDateRange({ startDate: '', endDate: '' });
    setTourTypeFilters([]);
  };

  const openFollowUpModal = (followUp?: FollowUp) => {
    if (followUp) {
      setEditingFollowUp(followUp);
      setFollowUpTitle(followUp.title);
      setFollowUpNote(followUp.description || '');
      const date = new Date(followUp.dueDate);
      const iso = date.toISOString().slice(0, 16);
      setFollowUpDateTime(iso);
    } else {
      setEditingFollowUp(null);
      setFollowUpTitle('Follow up with client');
      setFollowUpNote('');
      setFollowUpDateTime('');
    }
    setShowFollowUpModal(true);
  };

  const saveFollowUp = async () => {
    if (!selectedLead || !followUpDateTime || !followUpTitle) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      if (editingFollowUp) {
        await followUpsAPI.update(editingFollowUp.id, {
          title: followUpTitle,
          description: followUpNote,
          dueDate: new Date(followUpDateTime).toISOString(),
        });
      } else {
        await followUpsAPI.create({
          leadId: String(selectedLead.id),
          title: followUpTitle,
          description: followUpNote,
          dueDate: new Date(followUpDateTime).toISOString(),
          priority: 'medium',
          status: 'upcoming',
        });
      }
      setShowFollowUpModal(false);
      await onRefreshFollowUps();
    } catch (error) {
      console.error('Failed to save follow-up:', error);
      alert('Failed to save follow-up');
    }
  };

  const cancelFollowUp = async (followUp: FollowUp) => {
    try {
      await followUpsAPI.update(followUp.id, { status: 'canceled' });
      await onRefreshFollowUps();
    } catch (error) {
      console.error('Failed to cancel follow-up:', error);
      alert('Failed to cancel follow-up');
    }
  };

  const deleteFollowUp = async (followUp: FollowUp) => {
    if (!confirm('Are you sure you want to delete this follow-up?')) return;
    try {
      await followUpsAPI.delete(followUp.id);
      await onRefreshFollowUps();
    } catch (error) {
      console.error('Failed to delete follow-up:', error);
      alert('Failed to delete follow-up');
    }
  };

  const completeFollowUpWithRemarks = async (followUp: FollowUp) => {
    try {
      await followUpsAPI.complete(followUp.id, completionRemarks || undefined);
      setShowCompletionModal(false);
      setCompletionRemarks('');
      await onRefreshFollowUps();
      await onRefreshLeads();
      window.dispatchEvent(new Event('followups-updated'));
    } catch (error) {
      console.error('Failed to complete follow-up:', error);
      alert('Failed to complete follow-up');
    }
  };

  const cancelLead = async () => {
    if (!selectedLead) return;
    setShowCancelLeadModal(true);
  };

  const confirmCancelLead = async () => {
    if (!selectedLead) return;
    try {
      const combinedReason = cancelLeadReasonDetail
        ? `${cancelLeadReason} - ${cancelLeadReasonDetail}`
        : cancelLeadReason;

      await leadsAPI.cancel(String(selectedLead.id), combinedReason);
      setShowCancelLeadModal(false);
      setCancelLeadReason('');
      setCancelLeadReasonDetail('');
      setSelectedLead(null);
      await onRefreshLeads();
    } catch (error) {
      console.error('Failed to cancel lead:', error);
      alert('Failed to cancel lead');
    }
  };

  const markLeadAsSpam = async () => {
    if (!selectedLead) return;
    try {
      await leadsAPI.update(String(selectedLead.id), { status: 'spam' });
      setSelectedLead(null);
      await onRefreshLeads();
    } catch (error) {
      console.error('Failed to mark lead as spam:', error);
      alert('Failed to mark lead as spam');
    }
  };

  const deleteLead = async () => {
    if (!selectedLead || !confirm('Are you sure you want to delete this lead?')) return;
    try {
      await leadsAPI.delete(String(selectedLead.id));
      setSelectedLead(null);
      await onRefreshLeads();
    } catch (error) {
      console.error('Failed to delete lead:', error);
      alert('Failed to delete lead');
    }
  };

  const moveLeadStage = async (leadId: string, newStage: string) => {
    try {
      await leadsAPI.update(leadId, { pipelineStage: newStage as PipelineStage });
      await onRefreshLeads();
    } catch (error) {
      console.error('Failed to move lead stage:', error);
      alert('Failed to move lead to new stage');
    }
  };

  const statusTabs: { key: StatusFilter; label: string; color: string }[] = [
    { key: 'all', label: `All (${statusCounts.all})`, color: 'bg-slate-200 dark:bg-slate-700' },
    { key: 'active', label: `Active (${statusCounts.active})`, color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
    { key: 'potential', label: `Potential (${statusCounts.potential})`, color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
    { key: 'in_progress', label: `In Progress (${statusCounts.in_progress})`, color: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200' },
    { key: 'dead', label: `Dead (${statusCounts.dead})`, color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200' },
    { key: 'confirmed', label: `Confirmed (${statusCounts.confirmed})`, color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200' },
    { key: 'new', label: `New (${statusCounts.new})`, color: 'bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200' },
    { key: 'cancelled', label: `Cancelled (${statusCounts.cancelled})`, color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' },
    { key: 'spam', label: `Spam (${statusCounts.spam})`, color: 'bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200' },
  ];

  return (
    <div className="space-y-5">
      {/* Premium Page Header */}
      <div className="mb-6">
        <div className="flex flex-col gap-4 bg-gradient-to-r from-slate-900 to-slate-800 rounded-xl p-6 text-white shadow-lg md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-amber-400 mb-2">📊 Sales Pipeline</p>
            <h1 className="text-4xl font-bold mb-2">Leads Management</h1>
            <p className="text-slate-300">Convert prospects into customers with intelligent pipeline management</p>
          </div>
          <div className="flex gap-3">
            <div className="bg-white/10 backdrop-blur rounded-lg px-4 py-3 text-center border border-white/20">
              <p className="text-amber-400 text-sm font-semibold">{filteredLeads.length}</p>
              <p className="text-xs text-slate-300">Visible</p>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-lg px-4 py-3 text-center border border-white/20">
              <p className="text-green-400 text-sm font-semibold">{statusCounts.active}</p>
              <p className="text-xs text-slate-300">Active</p>
            </div>
          </div>
        </div>
      </div>

      {/* Status Tabs - Premium Style */}
      <div className="mb-6 overflow-x-auto">
        <div className="flex gap-2 pb-2 min-w-max">
          {statusTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveFilter(tab.key)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${
                activeFilter === tab.key
                  ? `${tab.color} shadow-md transform scale-105`
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <main className="space-y-6">
        {/* Filters Section */}
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-slate-900 uppercase tracking-wide">🔍 Search & Filter</p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant={leadView === 'kanban' ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => setLeadView('kanban')}
                  className="font-semibold"
                >
                  📊 Kanban
                </Button>
                <Button
                  variant={leadView === 'list' ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => setLeadView('list')}
                  className="font-semibold"
                >
                  📋 List
                </Button>
                <LeadForm onSuccess={onRefreshLeads} onOpenChange={(isOpen) => setPipelineCollapsed(isOpen)} />
              </div>
            </div>

            {/* Search & Filters Grid */}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
                <input
                  className="input-field pl-10"
                  placeholder="Client, phone or email"
                  value={leadSearchQuery}
                  onChange={(e) => setLeadSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void handleLeadSearch();
                  }}
                />
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">📍</span>
                <input
                  className="input-field pl-10"
                  placeholder="Destination"
                  value={locationFilter}
                  onChange={(e) => setLocationFilter(e.target.value)}
                />
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">📅</span>
                <input
                  className="input-field pl-10"
                  placeholder="Travel month"
                  value={travelMonthFilter}
                  onChange={(e) => setTravelMonthFilter(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 bg-slate-50">
                <span className="text-xs font-semibold text-slate-600">Tour:</span>
                {(['private', 'group'] as const).map((type) => {
                  const active = tourTypeFilters.includes(type);
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setTourTypeFilters((prev) =>
                        prev.includes(type) ? prev.filter((item) => item !== type) : [...prev, type]
                      )}
                      className={`rounded px-3 py-1 text-xs font-semibold transition-all ${
                        active 
                          ? 'bg-amber-500 text-white shadow-md' 
                          : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {type === 'private' ? '👤' : '👥'} {type}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Date Range & Actions */}
            <div className="flex flex-col gap-3 border-t border-slate-200 pt-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">📆 Created:</span>
                <input 
                  type="date" 
                  className="input-field !w-auto !py-2 text-sm" 
                  value={dateRangeStart} 
                  onChange={(e) => setDateRangeStart(e.target.value)} 
                />
                <span className="text-xs text-slate-500 font-medium">to</span>
                <input 
                  type="date" 
                  className="input-field !w-auto !py-2 text-sm" 
                  value={dateRangeEnd} 
                  onChange={(e) => setDateRangeEnd(e.target.value)} 
                />
              </div>
              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  onClick={() => void handleApplyLeadFilters()}
                  className="font-semibold"
                >
                  ✓ Apply
                </Button>
                <Button 
                  size="sm" 
                  variant="secondary" 
                  onClick={() => void handleClearLeadFilters()}
                  className="font-semibold"
                >
                  ↻ Reset
                </Button>
              </div>
            </div>
          </div>
        </section>

        {selectedLead && (
          <section className="rounded-xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-6 shadow-sm" ref={leadDetailRef}>
            <div className="flex flex-col gap-6">
              {/* Header */}
              <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-4 pb-6 border-b border-slate-200">
                <div className="flex-1">
                  <h2 className="text-3xl font-bold text-slate-900 mb-2">{selectedLead.clientName}</h2>
                  {nextPendingFollowUp && (
                    <p className="text-sm text-slate-600 bg-blue-50 px-3 py-2 rounded-lg inline-block">
                      ⏰ {formatKarachiFollowUpReminder(nextPendingFollowUp.dueDate)}
                      {nextPendingFollowUp.title ? ` — ${nextPendingFollowUp.title}` : ''}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-3 items-start">
                  {selectedLead.potential && (
                    <Badge color="bg-green-100 text-green-800">⭐ Potential</Badge>
                  )}
                  <div className="w-full md:w-auto">
                    <label className="text-xs text-slate-600 font-semibold block mb-2 uppercase tracking-wide">Lead Status</label>
                    <select
                      className="input-field text-sm font-semibold w-full"
                      value={getLeadLifecycleState(selectedLead)}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === 'canceled') {
                          void cancelLead();
                          return;
                        }
                        if (value === 'confirmed') {
                          setShowConfirmForm(true);
                          return;
                        }
                        (async () => {
                          const payload: any = { potential: value === 'potential' };
                          if (value === 'dead') {
                            payload.status = 'completed';
                            payload.temperature = 'dead';
                          } else if (value === 'in_progress') payload.status = 'contacted';
                          else if (value === 'new' || value === 'potential') payload.status = 'new';
                          try {
                            const resp = await leadsAPI.update(String(selectedLead.id), payload);
                            setSelectedLead(resp.data);
                            await onRefreshLeads();
                          } catch (err: any) {
                            console.error('Failed to update lead status', err);
                            const message = err?.response?.data?.message || err?.message || 'Unknown error';
                            alert(`Failed to update lead status: ${message}`);
                          }
                        })();
                      }}
                    >
                      <option value="new">New</option>
                      <option value="potential">Potential</option>
                      <option value="in_progress">In Progress</option>
                      <option value="dead">Dead</option>
                      <option value="confirmed">Confirmed</option>
                      <option value="spam">Spam</option>
                      <option value="canceled">Canceled</option>
                    </select>
                  </div>
                  <Button variant="danger" onClick={cancelLead}>
                    Cancel Lead
                  </Button>
                  <Button
                    variant="danger"
                    onClick={markLeadAsSpam}
                    className="bg-rose-700 hover:bg-rose-800 dark:bg-rose-900 dark:hover:bg-red-950"
                  >
                    Mark as Spam
                  </Button>
                  <Button
                    variant="danger"
                    onClick={deleteLead}
                    className="bg-red-700 hover:bg-red-800 dark:bg-red-900 dark:hover:bg-red-950"
                  >
                    Delete Lead
                  </Button>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-3">
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Email</p>
                    <p className="break-all">{selectedLead.email}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Phone</p>
                    <p className="break-all">{selectedLead.phone}</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Status</p>
                    <p className="capitalize">{getLeadLifecycleState(selectedLead)}</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Source</p>
                    <p className="capitalize">{selectedLead.source || 'Direct'}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">Destinations</p>
                  <div className="flex flex-wrap gap-2">
                    {(selectedLead.destinations && selectedLead.destinations.length > 0
                      ? selectedLead.destinations
                      : [selectedLead.destination]
                    ).map((destination, index) => (
                      <span key={`${destination}-${index}`} className="px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-sm">
                        {destination}
                      </span>
                    ))}
                  </div>
                </div>

                {selectedLead.hotelInfo && (
                  <div className="rounded-2xl bg-slate-50 dark:bg-slate-800 p-4">
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Hotel Details</p>
                    <p className="font-medium">{selectedLead.hotelInfo.hotelName}</p>
                    <p className="text-sm">{selectedLead.hotelInfo.roomType} · PKR {selectedLead.hotelInfo.roomPrice}</p>
                  </div>
                )}

                {selectedLead.tourType && (
                  <div className="rounded-2xl bg-slate-50 dark:bg-slate-800 p-4">
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Tour Type</p>
                    <p className="font-medium">{selectedLead.tourType}</p>
                  </div>
                )}

                {(selectedLead.agentRemarks || selectedLead.remarks) && (
                  <div className="rounded-2xl bg-slate-50 dark:bg-slate-800 p-4 space-y-3">
                    {selectedLead.agentRemarks && (
                      <div>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Agent Remarks</p>
                        <p className="text-sm">{selectedLead.agentRemarks}</p>
                      </div>
                    )}
                    {selectedLead.remarks && (
                      <div>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Remarks</p>
                        <p className="text-sm">{selectedLead.remarks}</p>
                      </div>
                    )}
                  </div>
                )}

                {selectedLead.hotelOptions && selectedLead.hotelOptions.length > 1 && (
                  <div className="rounded-2xl bg-slate-50 dark:bg-slate-800 p-4">
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">Additional Hotels</p>
                    <div className="space-y-2">
                      {selectedLead.hotelOptions.slice(1).map((hotel, index) => (
                        <div key={`${hotel.hotelName}-${index}`} className="flex flex-wrap justify-between gap-2 text-sm">
                          <span className="font-medium">{hotel.hotelName}</span>
                          <span>{hotel.roomType} · PKR {hotel.roomPrice}</span>
                        </div>

                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-2 justify-end">
                <Button variant="secondary" onClick={() => openFollowUpModal()}>
                  Schedule Follow Up
                </Button>
                {nextPendingFollowUp && (
                  <Button
                    variant="primary"
                    onClick={() => {
                      setCompletionRemarks('');
                      setShowCompletionModal(true);
                    }}
                  >
                    Follow-up Completed
                  </Button>
                )}
                <LeadForm
                  initialData={selectedLead}
                  onSuccess={async (lead) => {
                    setSelectedLead(lead);
                    await onRefreshLeads();
                  }}
                />
                <Button variant="secondary" onClick={() => setSelectedLead(null)}>
                  Close
                </Button>
              </div>
            </div>

            <section className="rounded-2xl bg-slate-50 dark:bg-slate-800 p-4">
              <div className="flex items-center justify-between gap-4 mb-4">
                <div>
                  <h3 className="text-xl font-semibold">Follow-ups</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Edit or remove any follow-up for this lead.</p>
                </div>
              </div>

              {selectedLeadFollowUps.length === 0 ? (
                <p className="text-sm text-slate-500">No active follow-ups yet. Create one to track this lead.</p>
              ) : (
                <div className="space-y-3">
                  {selectedLeadFollowUps.map((followUp) => (
                    <div key={followUp.id} className="rounded-2xl border border-slate-200 dark:border-slate-700 p-4 bg-white dark:bg-slate-900">
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold truncate">{followUp.title}</p>
                          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">Due {formatKarachiDateTime(followUp.dueDate)}</p>
                          {followUp.description && (
                            <p className="text-sm text-slate-600 dark:text-slate-400 mt-2 whitespace-pre-wrap">
                              Note: {followUp.description}
                            </p>
                          )}
                          {followUp.actionPlan && (
                            <p className="text-sm text-green-600 dark:text-green-400 mt-2 font-medium">✓ Action Plan: Filled</p>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" variant="secondary" onClick={() => openFollowUpModal(followUp)}>
                            Edit
                          </Button>
                          <Button size="sm" variant="secondary" onClick={() => cancelFollowUp(followUp)}>
                            Cancel
                          </Button>
                          <Button size="sm" variant="danger" onClick={() => deleteFollowUp(followUp)}>
                            Remove
                          </Button>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2 text-sm">
                        <span className="inline-block px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                          {followUp.priority || 'medium'} priority
                        </span>
                        <span className="inline-block px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 capitalize">
                          {followUp.status}
                        </span>
                        {followUp.status === 'canceled' && (
                          <span className="inline-block px-2 py-1 rounded-full bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-100">
                            Canceled
                          </span>
                        )}
                      </div>
                      {followUp.status === 'canceled' && followUp.canceledReason && (
                        <p className="mt-2 text-sm text-rose-700 dark:text-rose-200">Reason: {followUp.canceledReason}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </section>
        )}

        {selectedLead && <PaymentsPanel leadId={String(selectedLead.id)} lead={selectedLead} />}

        {showFollowUpModal && selectedLead && (
          <div ref={followUpModalRef} className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-hidden">
            <div className="w-full max-w-lg max-h-[90vh] rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-5 shadow-2xl flex flex-col overflow-auto">
              <h3 className="text-xl font-bold mb-1">Schedule Follow Up</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                Set the reminder date and time for {selectedLead.clientName}.
              </p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Title</label>
                  <input
                    className="input-field"
                    value={followUpTitle}
                    onChange={(e) => setFollowUpTitle(e.target.value)}
                    placeholder="Follow up with client"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Note</label>
                  <textarea
                    className="input-field min-h-[110px]"
                    value={followUpNote}
                    onChange={(e) => setFollowUpNote(e.target.value)}
                    placeholder="Add a note for this follow-up"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Date and Time</label>
                  <input
                    type="datetime-local"
                    className="input-field"
                    value={followUpDateTime}
                    onChange={(e) => setFollowUpDateTime(e.target.value)}
                  />
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-2">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setShowFollowUpModal(false);
                    setEditingFollowUp(null);
                  }}
                >
                  Cancel
                </Button>
                <Button variant="primary" onClick={saveFollowUp}>
                  {editingFollowUp ? 'Update Follow Up' : 'Save Follow Up'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {showCompletionModal && nextPendingFollowUp && (
          <div ref={completionModalRef} className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-hidden">
            <div className="w-full max-w-lg max-h-[90vh] rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-5 shadow-2xl flex flex-col overflow-auto">
              <h3 className="text-xl font-bold mb-1">Mark Follow-up Complete</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                Follow-up: <span className="font-medium">{nextPendingFollowUp.title}</span>
              </p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Agent Remarks</label>
                  <textarea
                    className="input-field resize-none"
                    rows={5}
                    value={completionRemarks}
                    onChange={(e) => setCompletionRemarks(e.target.value)}
                    placeholder="Write any notes or remarks about this follow-up..."
                  />
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-2">
                <Button variant="secondary" onClick={() => setShowCompletionModal(false)}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={async () => {
                    try {
                      await completeFollowUpWithRemarks(nextPendingFollowUp);
                    } catch (error) {
                      console.error('Failed to complete follow-up', error);
                      alert('Failed to complete follow-up.');
                    }
                  }}
                >
                  Mark Complete
                </Button>
              </div>
            </div>
          </div>
        )}

        {showCancelLeadModal && selectedLead && (
          <Modal
            isOpen={showCancelLeadModal}
            onClose={() => {
              setShowCancelLeadModal(false);
              setCancelLeadReason('');
              setCancelLeadReasonDetail('');
            }}
            title="Cancel Lead"
            footer={
              <>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setShowCancelLeadModal(false);
                    setCancelLeadReason('');
                    setCancelLeadReasonDetail('');
                  }}
                >
                  Close
                </Button>
                <Button variant="danger" onClick={confirmCancelLead} disabled={!cancelLeadReason}>
                  Confirm Cancel
                </Button>
              </>
            }
          >
            <div className="space-y-4">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Select the reason for canceling this lead before confirming.
              </p>
              <div>
                <label className="block text-sm font-medium mb-2">Cancellation Reason</label>
                <select
                  className="input-field w-full"
                  value={cancelLeadReason}
                  onChange={(e) => setCancelLeadReason(e.target.value)}
                >
                  <option value="">Select a reason</option>
                  {CANCEL_LEAD_REASONS.map((reason) => (
                    <option key={reason} value={reason}>
                      {reason}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Cancellation Notes</label>
                <textarea
                  className="input-field w-full min-h-[120px]"
                  value={cancelLeadReasonDetail}
                  onChange={(e) => setCancelLeadReasonDetail(e.target.value)}
                  placeholder="Write more details about why this lead is being canceled..."
                />
              </div>
            </div>
          </Modal>
        )}

        {selectedLead && showConfirmForm && (
          <ConfirmedLeadForm
            lead={selectedLead}
            isOpen={showConfirmForm}
            onClose={() => setShowConfirmForm(false)}
            onSaved={(updated) => {
              setSelectedLead(updated);
              setShowConfirmForm(false);
              onRefreshLeads();
            }}
          />
        )}

        <section className={`rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden transition-all ${pipelineCollapsed ? 'max-h-20' : ''}`}>
          <div className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-2xl">📈</span>
              <h2 className="text-2xl font-bold text-slate-900">Pipeline View</h2>
            </div>
            {leadView === 'kanban' ? (
              <KanbanPipeline leads={filteredLeads} onSelectLead={setSelectedLead} onMoveStage={moveLeadStage} />
            ) : (
              <LeadList leads={filteredLeads} onSelectLead={setSelectedLead} />
            )}
          </div>
        </section>

        {onLoadMoreLeads && leads.length >= 100 && (
          <div className="flex justify-center pt-4">
            <Button 
              variant="secondary" 
              onClick={() => void onLoadMoreLeads()}
              className="font-semibold"
            >
              ⬇️ Load More Leads
            </Button>
          </div>
        )}
        
      </main>
    </div>
  );
};
