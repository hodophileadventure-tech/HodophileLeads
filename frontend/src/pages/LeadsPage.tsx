import React, { useMemo, useState } from 'react';
import { leadsAPI, followUpsAPI } from '../utils/api-service';
import { Button, Badge, Modal } from '../components/common';
import { LeadForm } from '../components/LeadForm';
import ConfirmedLeadForm from '../components/ConfirmedLeadForm';
import { KanbanPipeline } from '../components/KanbanPipeline';
import { LeadList } from '../components/LeadCard';
import PaymentsPanel from '../components/PaymentsPanel';
import type { Lead, FollowUp, PipelineStage } from '../types';
import { 
  formatDate,
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

type StatusFilter = 'all' | 'active' | 'potential' | 'in_progress' | 'dead' | 'confirmed' | 'canceled' | 'spam';

interface LeadsPageProps {
  leads: Lead[];
  followUps: FollowUp[];
  onRefreshLeads: () => Promise<void>;
  onRefreshFollowUps: () => Promise<void>;
}

export const LeadsPage: React.FC<LeadsPageProps> = ({
  leads,
  followUps,
  onRefreshLeads,
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
  const [showConfirmForm, setShowConfirmForm] = useState(false);
  const [pipelineCollapsed, setPipelineCollapsed] = useState(false);
  const leadDetailRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!selectedLead || !leadDetailRef.current) return;
    const t = setTimeout(() => {
      try {
        leadDetailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } catch {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }, 50);
    return () => clearTimeout(t);
  }, [selectedLead]);

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
        const status = String((lead as any).status || '').toLowerCase();
        const lifecycle = getLeadLifecycleState(lead);

        if (activeFilter === 'canceled') return status === 'canceled';
        if (activeFilter === 'spam') return status === 'spam';
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
      canceled: leads.filter((lead) => String((lead as any).status || '').toLowerCase() === 'canceled').length,
      spam: leads.filter((lead) => String((lead as any).status || '').toLowerCase() === 'spam').length,
    };
  }, [leads]);

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
      await leadsAPI.update(String(selectedLead.id), {
        status: 'canceled',
        canceledReason: cancelLeadReason,
      });
      setShowCancelLeadModal(false);
      setCancelLeadReason('');
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
    { key: 'canceled', label: `Canceled (${statusCounts.canceled})`, color: 'bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900 dark:text-fuchsia-200' },
    { key: 'spam', label: `Spam (${statusCounts.spam})`, color: 'bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200' },
  ];

  return (
    <div className="space-y-6">
      {/* Status Tabs */}
      <div className="flex flex-wrap gap-2">
        {statusTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveFilter(tab.key)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeFilter === tab.key
                ? `${tab.color}`
                : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Main Content */}
      <main className="space-y-6">
        <section className="card">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4">
            <div>
              <h1 className="text-3xl font-bold">Leads</h1>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                Manage your pipeline, schedule follow-ups, and review lead details in dedicated sections.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <input
                  className="input-field"
                  placeholder="Search phone number"
                  value={leadSearchQuery}
                  onChange={(e) => setLeadSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void handleLeadSearch();
                  }}
                />
                <label className="text-sm text-slate-600 dark:text-slate-400">From</label>
                <input type="date" className="input-field" value={dateRangeStart} onChange={(e) => setDateRangeStart(e.target.value)} />
                <label className="text-sm text-slate-600 dark:text-slate-400">To</label>
                <input type="date" className="input-field" value={dateRangeEnd} onChange={(e) => setDateRangeEnd(e.target.value)} />
                        <label className="text-sm text-slate-600 dark:text-slate-400">Location</label>
                <input
                  className="input-field"
                  placeholder="Enter location"
                  value={locationFilter}
                  onChange={(e) => setLocationFilter(e.target.value)}
                />
                <label className="text-sm text-slate-600 dark:text-slate-400">Travel month</label>
                <input
                  className="input-field"
                  placeholder="Enter month"
                  value={travelMonthFilter}
                  onChange={(e) => setTravelMonthFilter(e.target.value)}
                />
                <label className="text-sm text-slate-600 dark:text-slate-400">Tour type</label>
                <div className="flex items-center gap-2">
                  {(['private', 'group'] as const).map((type) => {
                    const active = tourTypeFilters.includes(type);
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setTourTypeFilters((prev) =>
                          prev.includes(type) ? prev.filter((item) => item !== type) : [...prev, type]
                        )}
                        className={`text-xs px-2 py-1 rounded ${active ? 'bg-primary-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200'}`}
                      >
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </button>
                    );
                  })}
                </div>
                <Button onClick={() => void handleApplyLeadFilters()}>Apply</Button>
                <Button variant="secondary" onClick={() => void handleClearLeadFilters()}>
                  Clear
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant={leadView === 'kanban' ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setLeadView('kanban')}
              >
                Kanban
              </Button>
              <Button
                variant={leadView === 'list' ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setLeadView('list')}
              >
                List
              </Button>
              <LeadForm onSuccess={onRefreshLeads} onOpenChange={(isOpen) => setPipelineCollapsed(isOpen)} />
            </div>
          </div>
        </section>

        {selectedLead && (
          <section className="card" ref={leadDetailRef}>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-4">
                <div className="space-y-3">
                  <h2 className="text-2xl font-bold">{selectedLead.clientName}</h2>
                  {nextPendingFollowUp && (
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      {formatKarachiFollowUpReminder(nextPendingFollowUp.dueDate)}
                      {nextPendingFollowUp.title ? ` — ${nextPendingFollowUp.title}` : ''}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 items-center">
                  {selectedLead.potential && (
                    <Badge color="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Potential</Badge>
                  )}
                  <div>
                    <label className="text-xs text-slate-400 block">Lead Status</label>
                    <select
                      className="input-field text-sm"
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
                  <div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Created</p>
                    <p>{formatDate(selectedLead.createdAt)}</p>
                  </div>
                  {selectedLead.updatedAt && selectedLead.updatedAt !== selectedLead.createdAt && (
                    <div>
                      <p className="text-sm text-slate-600 dark:text-slate-400">Last Updated</p>
                      <p>{formatDate(selectedLead.updatedAt)}</p>
                    </div>
                  )}
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
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-5 shadow-2xl">
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
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-5 shadow-2xl">
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
            }}
            title="Cancel Lead"
            footer={
              <>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setShowCancelLeadModal(false);
                    setCancelLeadReason('');
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

        <section className={`card ${pipelineCollapsed ? 'max-h-20 overflow-hidden' : ''}`}>
          <h2 className="text-2xl font-semibold mb-4">Pipeline View</h2>
          {leadView === 'kanban' ? (
            <KanbanPipeline leads={filteredLeads} onSelectLead={setSelectedLead} onMoveStage={moveLeadStage} />
          ) : (
            <LeadList leads={filteredLeads} onSelectLead={setSelectedLead} />
          )}
        </section>
      </main>
    </div>
  );
};
