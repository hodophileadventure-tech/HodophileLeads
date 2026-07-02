import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useUIStore, useDataStore } from '../context/store';
import { leadsAPI, followUpsAPI, quoteRequestsAPI } from '../utils/api-service';
import { Navbar } from '../components/Navbar';
import { Sidebar } from '../components/Sidebar';
import { Dashboard } from '../components/Dashboard';
import AgentPanel from '../components/AgentPanel';
import ReportIssuePage from './ReportIssuePage';
import DailyReportsPage from './DailyReportsPage';
import DeveloperPanel from './DeveloperPanel';
import { TaskDashboard } from '../components/TaskDashboard';
import { AnalyticsDashboard } from '../components/AnalyticsDashboard';
import { LeadList } from '../components/LeadCard';
import { KanbanPipeline } from '../components/KanbanPipeline';
import { LeadForm } from '../components/LeadForm';
import ConfirmedLeadForm from '../components/ConfirmedLeadForm';
import PaymentsPanel from '../components/PaymentsPanel';
import { PendingQuotesPanel } from '../components/PendingQuotesPanel';
import { ManagerQuotationsPanel } from '../components/ManagerQuotationsPanel';
import { HotelsPanel } from '../components/HotelsPanel';
import AdminQuotationApprovalsPage from './AdminQuotationApprovalsPage';
import { QuoteInvoicePage } from './QuoteInvoicePage';
import { Badge, Button, Spinner } from '../components/common';
import type { Lead, FollowUp, QuoteRequest } from '../types';
import { formatKarachiDateTime, formatKarachiFollowUpReminder, getKarachiLocalDateTimeString, parseKarachiDateTimeToISOString, getLeadLifecycleState } from '../utils/helpers';
import { normalizeFollowUp } from '../utils/followup-utils';

type Page = 'dashboard' | 'leads' | 'followups' | 'analytics' | 'agent' | 'quoteinvoice' | 'pending-quotes' | 'quotation-approvals' | 'report-issue' | 'daily-reports' | 'dev-panel' | 'manager-quotations' | 'hotels';

 

const DISMISSED_FOLLOW_UPS_KEY = 'dismissedFollowUps';

const readDismissedFollowUps = (): Record<string, number> => {
  try {
    const raw = localStorage.getItem(DISMISSED_FOLLOW_UPS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const writeDismissedFollowUps = (items: Record<string, number>) => {
  try {
    localStorage.setItem(DISMISSED_FOLLOW_UPS_KEY, JSON.stringify(items));
  } catch {
    // ignore storage errors
  }
};

export const App: React.FC = () => {
  const { user } = useAuth();
  const { darkMode } = useUIStore();
  const { leads, followUps, setLeads, setFollowUps, updateLead } = useDataStore();
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [loading, setLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const leadDetailRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!selectedLead || !leadDetailRef.current) return;
    // small delay to allow layout to update before scrolling
    const t = setTimeout(() => {
      try {
        leadDetailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } catch {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }, 50);
    return () => clearTimeout(t);
  }, [selectedLead]);

  React.useEffect(() => {
    const leadId = selectedLead?.id;
    if (!leadId) return;

    let cancelled = false;

    const refreshSelectedLead = async () => {
      try {
        const response = await leadsAPI.getById(String(leadId));
        if (cancelled) return;
        setSelectedLead(response.data);
        updateLead(response.data);
      } catch (error) {
        console.error('Failed to hydrate selected lead from server:', error);
      }
    };

    void refreshSelectedLead();

    return () => {
      cancelled = true;
    };
  }, [selectedLead?.id]);

  React.useEffect(() => {
    const handleQuotationSaved = async (event: Event) => {
      const customEvent = event as CustomEvent<{ leadId?: string; lead?: Lead | null }>;
      const leadId = customEvent.detail?.leadId || customEvent.detail?.lead?.id || selectedLead?.id;
      const lead = customEvent.detail?.lead;
      if (!leadId && !lead) return;

      try {
        if (lead) {
          setSelectedLead(lead);
          updateLead(lead);
          return;
        }

        const response = await leadsAPI.getById(String(leadId));
        setSelectedLead(response.data);
        updateLead(response.data);
      } catch (error) {
        console.error('Failed to refresh lead after quotation save:', error);
      }
    };

    window.addEventListener('quote-request-saved', handleQuotationSaved as EventListener);
    window.addEventListener('lead-payment-pricing-updated', handleQuotationSaved as EventListener);

    return () => {
      window.removeEventListener('quote-request-saved', handleQuotationSaved as EventListener);
      window.removeEventListener('lead-payment-pricing-updated', handleQuotationSaved as EventListener);
    };
  }, [selectedLead?.id]);
  const [leadView, setLeadView] = useState<'list' | 'kanban'>('kanban');
  const [pipelineCollapsed, setPipelineCollapsed] = useState(false);
  const [showFollowUpModal, setShowFollowUpModal] = useState(false);
  const [editingFollowUp, setEditingFollowUp] = useState<FollowUp | null>(null);
  const [followUpTitle, setFollowUpTitle] = useState('Follow up with client');
  const [followUpNote, setFollowUpNote] = useState('');
  const [followUpDateTime, setFollowUpDateTime] = useState('');
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [completionRemarks, setCompletionRemarks] = useState('');
  const [showConfirmForm, setShowConfirmForm] = useState(false);
  const [activeAlarm, setActiveAlarm] = useState<FollowUp | null>(null);
  const [dismissedFollowUps, setDismissedFollowUps] = useState<Record<string, number>>(() => readDismissedFollowUps());
  const [selectedQuoteRequest, setSelectedQuoteRequest] = useState<QuoteRequest | null>(null);
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [leadSearchQuery, setLeadSearchQuery] = useState('');
  const [dateRangeStart, setDateRangeStart] = useState('');
  const [dateRangeEnd, setDateRangeEnd] = useState('');
  const [appliedDateRange, setAppliedDateRange] = useState<{ startDate: string; endDate: string }>({ startDate: '', endDate: '' });
  const alarmAudioRef = useRef<HTMLAudioElement | null>(null);
  const alarmAudioContextRef = useRef<AudioContext | null>(null);
  const audioUnlockedRef = useRef(false);
  const handlePreviewGenerated = useCallback((dataUrl: string) => {
    setPreviewDataUrl(dataUrl);
  }, []);

  const selectedLeadFollowUps = useMemo(() => {
    if (!selectedLead) return [];
    return followUps
      .filter((item) => item.leadId === String(selectedLead.id) && item.status !== 'completed')
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  }, [followUps, selectedLead]);

  const nextPendingFollowUp = useMemo(() => selectedLeadFollowUps[0] || null, [selectedLeadFollowUps]);

  // Memoize leadData for quotation forms to prevent unnecessary re-renders
  const memoizedManagerQuotationLeadData = useMemo(() => {
    if (!selectedQuoteRequest) return null;
    return {
      clientName: selectedQuoteRequest.leadClientName,
      phone: selectedQuoteRequest.leadPhone,
      destination: selectedQuoteRequest.leadDestination,
      travelDates: selectedQuoteRequest.leadTravelDates,
      persons: selectedQuoteRequest.leadPersons,
      address: '',
    };
  }, [
    selectedQuoteRequest?.leadClientName,
    selectedQuoteRequest?.leadPhone,
    selectedQuoteRequest?.leadDestination,
    selectedQuoteRequest?.leadTravelDates,
    selectedQuoteRequest?.leadPersons,
  ]);

  const stopAlarmAudio = () => {
    try {
      alarmAudioRef.current?.pause();
      if (alarmAudioRef.current) alarmAudioRef.current.currentTime = 0;
    } catch {
      // ignore audio cleanup errors
    }
  };

  const playBuzzerFallback = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;

      if (!alarmAudioContextRef.current) {
        alarmAudioContextRef.current = new AudioContextClass();
      }

      const context = alarmAudioContextRef.current;
      if (context.state === 'suspended') {
        void context.resume();
      }

      const oscillator = context.createOscillator();
      const gainNode = context.createGain();
      oscillator.type = 'square';
      oscillator.frequency.value = 880;
      gainNode.gain.value = 0.0001;
      oscillator.connect(gainNode);
      gainNode.connect(context.destination);

      const now = context.currentTime;
      gainNode.gain.setValueAtTime(0.0001, now);
      gainNode.gain.exponentialRampToValueAtTime(0.12, now + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);

      oscillator.start(now);
      oscillator.stop(now + 0.36);
    } catch (error) {
      console.warn('Alarm fallback buzzer failed', error);
    }
  };

  const primeAlarmAudio = () => {
    if (audioUnlockedRef.current) return;
    audioUnlockedRef.current = true;

    try {
      if (!alarmAudioRef.current) {
        alarmAudioRef.current = new Audio('/followup-alarm.wav');
        alarmAudioRef.current.loop = true;
        alarmAudioRef.current.volume = 1;
        alarmAudioRef.current.preload = 'auto';
        alarmAudioRef.current.load();
      }

      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass && !alarmAudioContextRef.current) {
        alarmAudioContextRef.current = new AudioContextClass();
      }
      void alarmAudioContextRef.current?.resume();
    } catch (error) {
      console.warn('Alarm audio prime failed', error);
    }
  };

  const dismissFollowUp = (item: FollowUp | null) => {
    if (!item) return;
    const dueAt = new Date(item.dueDate).getTime();
    const next = { ...readDismissedFollowUps(), [item.id]: Number.isFinite(dueAt) ? dueAt : Date.now() + 60 * 60 * 1000 };
    setDismissedFollowUps(next);
    writeDismissedFollowUps(next);
    stopAlarmAudio();
    setActiveAlarm(null);
  };

  const completeActiveFollowUp = async (item: FollowUp | null) => {
    if (!item) return;
    try {
      stopAlarmAudio();
      await followUpsAPI.complete(item.id);
      const next = { ...readDismissedFollowUps(), [item.id]: Date.now() + 24 * 60 * 60 * 1000 };
      setDismissedFollowUps(next);
      writeDismissedFollowUps(next);
      setActiveAlarm(null);
      window.dispatchEvent(new Event('followups-updated'));
    } catch (error) {
      console.error('Failed to complete follow-up:', error);
      alert('Failed to mark follow-up complete.');
    }
  };

  const completeFollowUpWithRemarks = async (item: FollowUp | null, remarks: string) => {
    if (!item) return;
    try {
      await followUpsAPI.update(item.id, {
        description: remarks,
        status: 'completed'
      });
      setShowCompletionModal(false);
      setCompletionRemarks('');
      await loadFollowUps();
      window.dispatchEvent(new Event('followups-updated'));
    } catch (error) {
      console.error('Failed to complete follow-up with remarks:', error);
      alert('Failed to mark follow-up complete.');
    }
  };

  const openFollowUpModal = (followUp?: FollowUp) => {
    setEditingFollowUp(followUp || null);
    setFollowUpTitle(followUp?.title || `Follow up with ${selectedLead?.clientName || 'client'}`);
    setFollowUpNote(followUp?.description || '');
    setFollowUpDateTime(
      followUp?.dueDate
        ? getKarachiLocalDateTimeString(new Date(followUp.dueDate))
        : getKarachiLocalDateTimeString(new Date(Date.now() + 24 * 60 * 60 * 1000))
    );
    setShowFollowUpModal(true);
  };

  const deleteFollowUp = async (item: FollowUp) => {
    if (!confirm('Delete this follow-up?')) return;
    try {
      await followUpsAPI.delete(item.id);
      if (activeAlarm?.id === item.id) {
        setActiveAlarm(null);
      }
      await loadFollowUps();
      window.dispatchEvent(new Event('followups-updated'));
    } catch (error) {
      console.error('Failed to delete follow-up:', error);
      alert('Failed to delete follow-up.');
    }
  };

  const cancelFollowUp = async (item: FollowUp) => {
    const reason = window.prompt('Reason for canceling this follow-up?')?.trim();
    if (!reason) return;
    try {
      await followUpsAPI.cancel(item.id, reason);
      if (activeAlarm?.id === item.id) {
        setActiveAlarm(null);
      }
      await loadFollowUps();
      window.dispatchEvent(new Event('followups-updated'));
    } catch (error) {
      console.error('Failed to cancel follow-up:', error);
      alert('Failed to cancel follow-up.');
    }
  };

  const cancelLead = async () => {
    if (!selectedLead) return;
    const reason = window.prompt('Reason for canceling this lead?')?.trim();
    if (!reason) return;
    try {
      const resp = await leadsAPI.cancel(String(selectedLead.id), reason);
      setSelectedLead(resp.data);
      await refreshLeads();
    } catch (error) {
      console.error('Failed to cancel lead:', error);
      alert('Failed to cancel lead.');
    }
  };

  const markLeadAsSpam = async () => {
    if (!selectedLead) return;
    const confirmed = window.confirm(
      `Mark lead ${selectedLead.clientName} as spam? This will preserve the lead record but change its status to spam.`
    );
    if (!confirmed) return;
    try {
      const resp = await leadsAPI.update(String(selectedLead.id), { status: 'spam', potential: false });
      setSelectedLead(resp.data);
      await refreshLeads();
      alert('Lead marked as spam.');
    } catch (error) {
      console.error('Failed to mark lead as spam:', error);
      alert('Failed to mark lead as spam.');
    }
  };

  const deleteLead = async () => {
    if (!selectedLead) return;
    const confirmed = window.confirm(
      `Are you sure you want to permanently delete this lead (${selectedLead.clientName})? This action cannot be undone.`
    );
    if (!confirmed) return;
    try {
      await leadsAPI.delete(String(selectedLead.id));
      setSelectedLead(null);
      await refreshLeads();
      alert('Lead deleted successfully.');
    } catch (error) {
      console.error('Failed to delete lead:', error);
      alert('Failed to delete lead.');
    }
  };

  const saveFollowUp = async () => {
    if (!selectedLead) return;
    if (!followUpTitle.trim()) {
      alert('Please enter a follow-up title.');
      return;
    }
    if (!followUpDateTime) {
      alert('Please choose a follow-up date and time.');
      return;
    }
    if (!editingFollowUp && !followUpNote.trim()) {
      alert('Please enter a note for the follow-up.');
      return;
    }

    try {
      if (!user) {
        alert('Unable to save follow-up without a signed-in user.');
        return;
      }

      const payload: Partial<FollowUp> = {
        title: followUpTitle.trim(),
        dueDate: parseKarachiDateTimeToISOString(followUpDateTime)
      };

      if (followUpNote.trim()) {
        payload.description = followUpNote.trim();
      }

      if (editingFollowUp) {
        await followUpsAPI.update(editingFollowUp.id, payload);
      } else {
        await followUpsAPI.create({
          ...payload,
          leadId: String(selectedLead.id),
          assignedTo: String(user.id),
          type: 'manual',
          priority: 'high'
        });
      }

      setShowFollowUpModal(false);
      setEditingFollowUp(null);
      await loadFollowUps();
      window.dispatchEvent(new Event('followups-updated'));
    } catch (error) {
      console.error('Failed to save follow-up:', error);
      alert('Failed to save follow-up.');
    }
  };

  const loadFollowUps = async () => {
    try {
      const response = await followUpsAPI.list();
      setFollowUps((response.data || []).map(normalizeFollowUp));
    } catch (error) {
      console.error('Failed to fetch follow-ups:', error);
    }
  };

  const refreshLeads = async () => {
    // Request up to 10,000 leads for all users
    const limit = 10000;
    const response = await leadsAPI.list(limit, {
      phone: leadSearchQuery.trim() || undefined,
      startDate: appliedDateRange.startDate || undefined,
      endDate: appliedDateRange.endDate || undefined
    });
    setLeads(response.data);
    await loadFollowUps();
  };

  const moveLeadStage = async (leadId: string, stage: string) => {
    await leadsAPI.updateStage(leadId, stage);
    await refreshLeads();
  };

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  useEffect(() => {
    if (!user) {
      window.location.href = '/login';
      return;
    }

    const fetchLeads = async () => {
      try {
        // Request up to 10,000 leads for all users (initial load without filters)
        const limit = 10000;
        const response = await leadsAPI.list(limit);
        setLeads(response.data);
        await loadFollowUps();
      } catch (error) {
        console.error('Failed to fetch leads:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchLeads();
  }, [user, setLeads]);

  const handleApplyLeadFilters = async () => {
    setAppliedDateRange({ startDate: dateRangeStart, endDate: dateRangeEnd });
    await refreshLeads();
  };

  const handleClearLeadFilters = async () => {
    setDateRangeStart('');
    setDateRangeEnd('');
    setAppliedDateRange({ startDate: '', endDate: '' });
    setLeadSearchQuery('');
    await refreshLeads();
  };

  const handleLeadSearch = async () => {
    await refreshLeads();
  };

  useEffect(() => {
    if (!user) return;

    let mounted = true;
    const checkFollowUps = async () => {
      try {
        const response = await followUpsAPI.list();
        if (!mounted) return;
        const now = Date.now();
        const oneHourMs = 60 * 60 * 1000;
        const soonest = (response.data || [])
          .map(normalizeFollowUp)
          .filter((item) => item.status !== 'completed')
          .filter((item) => (dismissedFollowUps[item.id] || 0) < Date.now())
          .filter((item) => {
            const dueAt = new Date(item.dueDate).getTime();
            return dueAt > now && dueAt - now <= oneHourMs;
          })
          .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0] || null;

        if (soonest && (!activeAlarm || activeAlarm.id !== soonest.id)) {
          setActiveAlarm(soonest);
        }
        if (!soonest && activeAlarm) {
          setActiveAlarm(null);
        }
      } catch (error) {
        console.error('Failed to check follow-ups for alerts:', error);
      }
    };

    void checkFollowUps();
    const timer = window.setInterval(() => {
      void checkFollowUps();
    }, 30000);
    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, [activeAlarm, dismissedFollowUps, followUps, user]);

  useEffect(() => {
    const handleFollowUpsUpdated = () => {
      void loadFollowUps();
    };

    window.addEventListener('followups-updated', handleFollowUpsUpdated);
    return () => window.removeEventListener('followups-updated', handleFollowUpsUpdated);
  }, []);

  useEffect(() => {
    const handleFollowupDue = (event: Event) => {
      const customEvent = event as CustomEvent<FollowUp>;
      const item = normalizeFollowUp(customEvent.detail);
      if (!item) return;
      const dueAt = new Date(item.dueDate).getTime();
      if (Number.isNaN(dueAt)) return;
      if ((dismissedFollowUps[item.id] || 0) >= Date.now()) return;
      if (dueAt - Date.now() <= 60 * 60 * 1000 && item.status !== 'completed') {
        setActiveAlarm(item);
      }
    };

    window.addEventListener('followup-due', handleFollowupDue as EventListener);
    return () => window.removeEventListener('followup-due', handleFollowupDue as EventListener);
  }, [dismissedFollowUps]);

  useEffect(() => {
    const handleUnlock = () => primeAlarmAudio();
    window.addEventListener('pointerdown', handleUnlock, { once: true });
    window.addEventListener('keydown', handleUnlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', handleUnlock);
      window.removeEventListener('keydown', handleUnlock);
    };
  }, []);

  useEffect(() => {
    if (!activeAlarm) {
      stopAlarmAudio();
      return;
    }

    primeAlarmAudio();

    if (!alarmAudioRef.current) {
      alarmAudioRef.current = new Audio('/followup-alarm.wav');
      alarmAudioRef.current.loop = true;
      alarmAudioRef.current.volume = 1;
      alarmAudioRef.current.preload = 'auto';
      alarmAudioRef.current.load();
    }

    void alarmAudioRef.current.play().catch((error) => {
      console.warn('Alarm playback failed until next user interaction', error);
      playBuzzerFallback();
    });

    return () => {
      stopAlarmAudio();
    };
  }, [activeAlarm]);

  const activeFollowUpLead = useMemo(() => {
    if (!activeAlarm) return null;
    return leads.find((lead) => String(lead.id) === String(activeAlarm.leadId)) || null;
  }, [activeAlarm, leads]);

  const navItems = [
    { label: 'Dashboard', href: 'dashboard', icon: '📊' },
    { label: 'Leads', href: 'leads', icon: '🧾' },
    { label: 'Follow-ups', href: 'followups', icon: '🕒' },
    { label: 'Report Issue', href: 'report-issue', icon: '🐞' },
    ...(user?.role === 'admin' ? [{ label: 'Daily Reports', href: 'daily-reports', icon: '📑' }] : []),
    ...(user?.role === 'admin' ? [{ label: 'Quotes & Invoices', href: 'quoteinvoice', icon: '🧾' }] : []),
    ...(user?.role === 'admin' ? [{ label: 'Pending Quotes', href: 'pending-quotes', icon: '📝' }] : []),
    ...(user?.role === 'admin' ? [{ label: 'Quotation Approvals', href: 'quotation-approvals', icon: '✅' }] : []),
    ...(user?.role === 'manager' ? [{ label: 'Manager Quotations', href: 'manager-quotations', icon: '📝' }] : []),
    ...(user?.role === 'admin' || user?.role === 'manager' ? [{ label: 'Hotel Directory', href: 'hotels', icon: '🏨' }] : []),
    { label: 'Agent Panel', href: 'agent', icon: '🧭' },
    ...(user?.role === 'admin' ? [{ label: 'Developer Panel', href: 'dev-panel', icon: '🛠️' }] : []),
    { label: 'Analytics', href: 'analytics', icon: '📈' }
  ];

  if (!user) return null;

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className={darkMode ? 'dark' : ''}>
      <div className="min-h-screen bg-white dark:bg-slate-900">
        <Navbar onNotificationClick={async (notification) => {
          try {
            if (notification?.type === 'quote_saved' && notification.payload?.requestId) {
              setCurrentPage('agent');
              window.setTimeout(() => {
                window.dispatchEvent(new CustomEvent('open-saved-quote', { detail: { requestId: notification.payload.requestId } }));
              }, 0);
              return;
            }

            if (notification?.type === 'quote_request' && notification.payload?.requestId) {
              const requestId = notification.payload.requestId;
              try {
                const res = await quoteRequestsAPI.getById(requestId);
                setSelectedQuoteRequest(res.data || null);
              } catch (err) {
                setSelectedQuoteRequest({ id: requestId, leadId: notification.payload.leadId, requestType: notification.payload.requestType } as any);
              }
              setCurrentPage('pending-quotes');
              return;
            }
          } catch (e) {
            console.error('Notification click handler error', e);
          }
        }} />
        <div className="flex">
          <Sidebar
            navItems={navItems}
            currentPath={currentPage}
            onNavigate={(path) => {
              // debug navigation
              // eslint-disable-next-line no-console
              console.log('Navigate to', path);
              setCurrentPage(path as Page);
            }}
          />

          {/* Main Content */}
          <main className="flex-1 p-6 mt-16 md:mt-0 ml-0 md:ml-0 overflow-auto">
            {(user?.role === 'admin' || user?.role === 'agent') && (
              <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <input
                    placeholder="Search quotations by client, phone, or quote #"
                    aria-label="Search quotations"
                    id="quick-quote-search"
                    className="border rounded px-3 py-2 w-full sm:w-[420px]"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const q = (e.target as HTMLInputElement).value.trim();
                        if (!q) return;
                        setCurrentPage('pending-quotes');
                        // let pending page render, then focus search
                        setTimeout(() => window.dispatchEvent(new CustomEvent('focus-quote-search', { detail: { query: q } })), 150);
                      }
                    }}
                  />
                  <button
                    className="btn-secondary px-3 py-2"
                    onClick={() => {
                      setCurrentPage('pending-quotes');
                      setTimeout(() => window.dispatchEvent(new CustomEvent('jump-to-quote-section', { detail: 'pending' })), 100);
                    }}
                  >
                    Pending
                  </button>
                  <button
                    className="btn-secondary px-3 py-2"
                    onClick={() => {
                      setCurrentPage('pending-quotes');
                      setTimeout(() => window.dispatchEvent(new CustomEvent('jump-to-quote-section', { detail: 'saved' })), 100);
                    }}
                  >
                    Saved
                  </button>
                </div>
                <div />
              </div>
            )}
            {currentPage === 'dashboard' && (
              <div className="space-y-6">
                <section className="card">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                      <h1 className="text-3xl font-bold">Dashboard</h1>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                        Your sales performance, pipeline health, and task summary all in one place.
                      </p>
                    </div>
                  </div>
                </section>
                          {selectedLead && selectedLead.status === 'canceled' && selectedLead.canceledReason && (
                            <div>
                              <p className="text-sm text-slate-600 dark:text-slate-400">Canceled Reason</p>
                              <p className="text-sm text-rose-700 dark:text-rose-200">{selectedLead.canceledReason}</p>
                            </div>
                          )}
                <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
                  <div className="card xl:col-span-2">
                    <Dashboard />
                  </div>
                  <div className="card space-y-4">
                    <h2 className="text-xl font-semibold">Quick Actions</h2>
                    <div className="space-y-3">
                      <div className="rounded-2xl bg-slate-50 dark:bg-slate-800 p-4">
                        <p className="text-sm text-slate-600 dark:text-slate-400">Need to follow up soon?</p>
                        <p className="mt-2 font-medium">Review your upcoming tasks and lead alerts.</p>
                      </div>
                      <div className="rounded-2xl bg-slate-50 dark:bg-slate-800 p-4">
                        <p className="text-sm text-slate-600 dark:text-slate-400">Lead board</p>
                        <p className="mt-2 font-medium">Switch to the Leads page for pipeline management.</p>
                      </div>
                    </div>
                  </div>
                </section>
              </div>
            )}
            {currentPage === 'report-issue' && (
              <ReportIssuePage />
            )}

            {currentPage === 'daily-reports' && user?.role === 'admin' && (
              <DailyReportsPage />
            )}

            {currentPage === 'dev-panel' && user?.role === 'admin' && (
              <DeveloperPanel />
            )}

            {currentPage === 'leads' && (
              <div className="space-y-6">
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
                          onKeyDown={(e) => { if (e.key === 'Enter') void handleLeadSearch(); }}
                        />
                        <label className="text-sm text-slate-600 dark:text-slate-400">From</label>
                        <input type="date" className="input-field" value={dateRangeStart} onChange={(e) => setDateRangeStart(e.target.value)} />
                        <label className="text-sm text-slate-600 dark:text-slate-400">To</label>
                        <input type="date" className="input-field" value={dateRangeEnd} onChange={(e) => setDateRangeEnd(e.target.value)} />
                        <Button onClick={() => void handleApplyLeadFilters()}>Apply</Button>
                        <Button variant="secondary" onClick={() => void handleClearLeadFilters()}>Clear</Button>
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
                      <LeadForm onSuccess={refreshLeads} onOpenChange={(isOpen) => setPipelineCollapsed(isOpen)} />
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
                            <Badge color="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                              Potential
                            </Badge>
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
                                  const payload: any = {
                                  potential: value === 'potential'
                                };
                                if (value === 'dead') {
                                  payload.status = 'completed';
                                  payload.temperature = 'dead';
                                } else if (value === 'in_progress') payload.status = 'contacted';
                                else if (value === 'new' || value === 'potential') payload.status = 'new';
                                console.log('[App] Status change:', { selectedValue: value, payload });
                                try {
                                    console.log('[App] Calling leadsAPI.update with:', { leadId: String(selectedLead.id), payload });
                                    const resp = await leadsAPI.update(String(selectedLead.id), payload);
                                    console.log('[App] Update response:', { status: resp.status, data: resp.data });
                                    setSelectedLead(resp.data);
                                    await refreshLeads();
                                    console.log('[App] Status update completed successfully');
                                  } catch (err: any) {
                                    console.error('[App] Failed to update lead status', err);
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
                          <Button variant="danger" onClick={markLeadAsSpam} className="bg-rose-700 hover:bg-rose-800 dark:bg-rose-900 dark:hover:bg-red-950">
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
                            {(selectedLead.destinations && selectedLead.destinations.length > 0 ? selectedLead.destinations : [selectedLead.destination]).map((destination, index) => (
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
                        <Button
                          variant="secondary"
                          onClick={() => openFollowUpModal()}
                        >
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
                            await refreshLeads();
                          }}
                        />
                        <Button
                          variant="secondary"
                          onClick={() => setSelectedLead(null)}
                        >
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
                                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                                    Due {formatKarachiDateTime(followUp.dueDate)}
                                  </p>
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
                                <p className="mt-2 text-sm text-rose-700 dark:text-rose-200">
                                  Reason: {followUp.canceledReason}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </section>
                  </section>
                )}

                {selectedLead && (
                  <PaymentsPanel leadId={String(selectedLead.id)} lead={selectedLead} />
                )}

                {showFollowUpModal && selectedLead && (
                  <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-5 shadow-2xl">
                      <h3 className="text-xl font-bold mb-1">Schedule Follow Up</h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Set the reminder date and time for {selectedLead.clientName}.</p>
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
                              await completeFollowUpWithRemarks(nextPendingFollowUp, completionRemarks);
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

                {selectedLead && showConfirmForm && (
                  <ConfirmedLeadForm
                    lead={selectedLead}
                    isOpen={showConfirmForm}
                    onClose={() => setShowConfirmForm(false)}
                    onSaved={(updated) => {
                      setSelectedLead(updated);
                      setShowConfirmForm(false);
                      refreshLeads();
                    }}
                  />
                )}

                <section className={`card ${pipelineCollapsed ? 'max-h-20 overflow-hidden' : ''}`}>
                  <h2 className="text-2xl font-semibold mb-4">Pipeline View</h2>
                  {leadView === 'kanban' ? (
                    <KanbanPipeline
                      leads={leads}
                      onSelectLead={setSelectedLead}
                      onMoveStage={moveLeadStage}
                    />
                  ) : (
                    <LeadList leads={leads} onSelectLead={setSelectedLead} />
                  )}
                </section>
              </div>
            )}

            {currentPage === 'agent' && (
              <div>
                <h1 className="text-3xl font-bold mb-4">Agent Panel</h1>
                <AgentPanel />
              </div>
            )}

            {currentPage === 'followups' && (
              <div className="space-y-6">
                <section className="card">
                  <h1 className="text-3xl font-bold">Follow-ups</h1>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    All follow-ups are listed here in a dedicated section so you can manage reminders and task status clearly.
                  </p>
                </section>
                <section className="card">
                  <TaskDashboard leads={leads} />
                </section>
              </div>
            )}

            {currentPage === 'analytics' && (
              <div className="space-y-6">
                <section className="card">
                  <h1 className="text-3xl font-bold">Analytics</h1>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    See your pipeline trends and agent performance at a glance.
                  </p>
                </section>
                <section className="card">
                  <AnalyticsDashboard isAdmin={user.role === 'admin'} />
                </section>
              </div>
            )}

            {currentPage === 'pending-quotes' && ['admin', 'manager'].includes(user?.role || '') && (
              <div className="space-y-6">
                {selectedQuoteRequest ? (
                  <div>
                    <Button 
                      variant="secondary" 
                      onClick={() => { setPreviewDataUrl(null); setSelectedQuoteRequest(null); }}
                      className="mb-4"
                    >
                      ← Back to Pending Requests
                    </Button>

                    <div className="grid grid-cols-3 gap-6 min-h-[80vh] w-full" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '24px' }}>
                      {/* Left: Lead Details */}
                      <aside className="col-span-1 border rounded bg-white dark:bg-slate-800 p-4 overflow-y-auto min-w-0" style={{ minWidth: 0 }}>
                        <h3 className="font-semibold mb-4 text-sm">Lead Details</h3>
                        <div className="space-y-3 text-sm">
                          <div className="bg-slate-50 dark:bg-slate-900 p-2 rounded">
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">CLIENT INFO</p>
                            <div className="mt-2 space-y-2">
                              <div>
                                <p className="text-xs text-slate-500">Name</p>
                                <p className="font-medium">{selectedQuoteRequest.leadClientName || '—'}</p>
                              </div>
                              <div>
                                <p className="text-xs text-slate-500">Phone</p>
                                <p className="font-medium">{selectedQuoteRequest.leadPhone || '—'}</p>
                              </div>
                              <div>
                                <p className="text-xs text-slate-500">Email</p>
                                <p className="font-medium text-blue-600 break-all text-xs">{selectedQuoteRequest.leadEmail || '—'}</p>
                              </div>
                            </div>
                          </div>

                          {(selectedQuoteRequest.requestedByName || selectedQuoteRequest.requestedBy) && (
                            <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 p-2 rounded">
                              <p className="text-xs text-blue-800 dark:text-blue-300 font-semibold">Requested By Agent</p>
                              <p className="text-xs text-blue-900 dark:text-blue-200 mt-1">{selectedQuoteRequest.requestedByName || selectedQuoteRequest.requestedBy || '—'}</p>
                            </div>
                          )}

                          <div className="bg-slate-50 dark:bg-slate-900 p-2 rounded">
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">TRIP DETAILS</p>
                            <div className="mt-2 space-y-2">
                              <div>
                                <p className="text-xs text-slate-500">Destination</p>
                                <p className="font-medium">{Array.isArray(selectedQuoteRequest.leadDestinations) ? selectedQuoteRequest.leadDestinations.join(', ') : selectedQuoteRequest.leadDestination || '—'}</p>
                              </div>
                              <div>
                                <p className="text-xs text-slate-500">Travel Date</p>
                                <p className="font-medium text-xs">{typeof selectedQuoteRequest.leadTravelDates === 'string' ? selectedQuoteRequest.leadTravelDates : selectedQuoteRequest.leadTravelDates?.from && selectedQuoteRequest.leadTravelDates?.to ? `${selectedQuoteRequest.leadTravelDates.from} - ${selectedQuoteRequest.leadTravelDates.to}` : '—'}</p>
                              </div>
                              <div>
                                <p className="text-xs text-slate-500">Persons</p>
                                <p className="font-medium">{selectedQuoteRequest.leadPersons || '—'}</p>
                              </div>
                              <div>
                                <p className="text-xs text-slate-500">Budget</p>
                                <p className="font-medium">Rs. {selectedQuoteRequest.leadBudget?.toLocaleString() || '—'}</p>
                              </div>
                            </div>
                          </div>

                          {(selectedQuoteRequest.leadRemarks || selectedQuoteRequest.leadAgentRemarks || selectedQuoteRequest.leadSpecialRequests || selectedQuoteRequest.leadTourType || selectedQuoteRequest.leadSource || selectedQuoteRequest.leadStatus || selectedQuoteRequest.leadLeadOutcome || selectedQuoteRequest.leadIslamabadStay || selectedQuoteRequest.leadAdults != null || selectedQuoteRequest.leadKids != null || selectedQuoteRequest.leadSeniors != null) && (
                            <div className="bg-slate-50 dark:bg-slate-900 p-2 rounded">
                              <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">PREFERENCES & DETAILS</p>
                              <div className="mt-2 space-y-2">
                                {selectedQuoteRequest.leadTourType && (
                                  <div>
                                    <p className="text-xs text-slate-500">Tour Type</p>
                                    <p className="font-medium text-xs">{selectedQuoteRequest.leadTourType}</p>
                                  </div>
                                )}
                                {selectedQuoteRequest.leadSource && (
                                  <div>
                                    <p className="text-xs text-slate-500">Source</p>
                                    <p className="font-medium text-xs">{selectedQuoteRequest.leadSource}</p>
                                  </div>
                                )}
                                {selectedQuoteRequest.leadStatus && (
                                  <div>
                                    <p className="text-xs text-slate-500">Lead Status</p>
                                    <p className="font-medium text-xs">{selectedQuoteRequest.leadStatus}</p>
                                  </div>
                                )}
                                {selectedQuoteRequest.leadLeadOutcome && (
                                  <div>
                                    <p className="text-xs text-slate-500">Lead Outcome</p>
                                    <p className="font-medium text-xs">{selectedQuoteRequest.leadLeadOutcome}</p>
                                  </div>
                                )}
                                {selectedQuoteRequest.leadIslamabadStay && (
                                  <div>
                                    <p className="text-xs text-slate-500">Islamabad Stay</p>
                                    <p className="font-medium text-xs">{selectedQuoteRequest.leadIslamabadStay}</p>
                                  </div>
                                )}
                                {(selectedQuoteRequest.leadAdults != null || selectedQuoteRequest.leadKids != null || selectedQuoteRequest.leadSeniors != null) && (
                                  <div>
                                    <p className="text-xs text-slate-500">Party Composition</p>
                                    <p className="font-medium text-xs">
                                      {selectedQuoteRequest.leadAdults ?? 0} adults
                                      {selectedQuoteRequest.leadKids != null ? `, ${selectedQuoteRequest.leadKids} kids` : ''}
                                      {selectedQuoteRequest.leadSeniors != null ? `, ${selectedQuoteRequest.leadSeniors} seniors` : ''}
                                    </p>
                                  </div>
                                )}
                                {selectedQuoteRequest.leadSpecialRequests && (
                                  <div>
                                    <p className="text-xs text-slate-500">Special Requests</p>
                                    <p className="font-medium text-xs">{selectedQuoteRequest.leadSpecialRequests}</p>
                                  </div>
                                )}
                                {selectedQuoteRequest.leadAgentRemarks && (
                                  <div className="border-t border-slate-300 dark:border-slate-600 pt-2">
                                    <p className="text-xs text-yellow-700 dark:text-yellow-300 font-semibold">Agent Remarks</p>
                                    <p className="text-xs text-yellow-900 dark:text-yellow-200 mt-1">{selectedQuoteRequest.leadAgentRemarks}</p>
                                  </div>
                                )}
                                {selectedQuoteRequest.leadRemarks && (
                                  <div className="border-t border-slate-300 dark:border-slate-600 pt-2">
                                    <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">Lead Notes</p>
                                    <p className="text-xs text-slate-800 dark:text-slate-200 mt-1">{selectedQuoteRequest.leadRemarks}</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </aside>

                      {/* Middle: Quotation Form */}
                      <main className="col-span-1 overflow-y-auto border rounded bg-white dark:bg-slate-800 p-4 min-w-0" style={{ minWidth: 0 }}>
                        <QuoteInvoicePage
                          key={selectedQuoteRequest.id}
                          leadId={selectedQuoteRequest.leadId}
                          embedded={true}
                          leadData={memoizedManagerQuotationLeadData}
                          requestId={selectedQuoteRequest.id}
                          requestType={selectedQuoteRequest.requestType}
                          requestStatus={selectedQuoteRequest.status as any}
                          initialDocumentData={selectedQuoteRequest.documentData}
                          initialQuotationNumber={selectedQuoteRequest.quotationNumber}
                          onSaved={() => {
                            setSelectedQuoteRequest(null);
                            setCurrentPage('pending-quotes');
                          }}
                          onClose={() => setSelectedQuoteRequest(null)}
                          viewOnly={false}
                          generatePreviewOnMount
                          onPreviewGenerated={handlePreviewGenerated}
                          hidePreview={true}
                        />
                      </main>

                      {/* Right: Preview */}
                      <aside className="col-span-1 border rounded bg-white dark:bg-slate-800 p-4 flex flex-col overflow-hidden min-w-0" style={{ minWidth: 0 }}>
                        <h3 className="font-semibold mb-3 text-base flex-shrink-0">Preview</h3>
                        <div className="flex-1 overflow-auto flex items-center justify-center bg-slate-50 dark:bg-slate-900 rounded mb-3">
                          {previewDataUrl ? (
                            <img src={previewDataUrl} alt="Quotation preview" className="w-full max-h-full object-contain rounded" />
                          ) : (
                            <div className="text-sm text-slate-500">Generating preview…</div>
                          )}
                        </div>
                        <div className="flex flex-col gap-2 flex-shrink-0">
                          <button className="btn-secondary text-sm py-2 px-3" onClick={() => window.dispatchEvent(new Event('generate-quote-preview'))}>Regenerate</button>
                          {previewDataUrl && (
                            <a className="btn-primary text-center text-sm py-2 px-3 rounded" href={previewDataUrl} download={`${selectedQuoteRequest.requestType || 'quotation'}-preview.jpeg`}>Download JPEG</a>
                          )}
                        </div>
                      </aside>
                    </div>
                  </div>
                ) : (
                  <PendingQuotesPanel onSelectRequest={(request) => {
                    setSelectedQuoteRequest(request);
                  }} />
                )}
              </div>
            )}

            {currentPage === 'quotation-approvals' && user?.role === 'admin' && (
              <AdminQuotationApprovalsPage 
                selectedRequest={selectedQuoteRequest}
                onSelectRequest={(request: QuoteRequest | null) => setSelectedQuoteRequest(request)}
                onRequestUpdated={() => {
                  setSelectedQuoteRequest(null);
                  // Refresh the list by reloading
                  window.dispatchEvent(new Event('quotation-approvals-updated'));
                }}
              />
            )}

            {currentPage === 'quoteinvoice' && user?.role === 'admin' && (
              <div className="space-y-6">
                <QuoteInvoicePage />
              </div>
            )}
            {currentPage === 'quoteinvoice' && user?.role !== 'admin' && (
              <div className="space-y-6">
                <section className="card">
                  <h1 className="text-3xl font-bold">Access Denied</h1>
                  <p className="text-sm text-slate-600 dark:text-slate-400">You do not have permission to view quotes and invoices.</p>
                </section>
              </div>
            )}

            {currentPage === 'manager-quotations' && user?.role === 'manager' && (
              <div className="space-y-6">
                {selectedQuoteRequest ? (
                  <div>
                    <Button 
                      variant="secondary" 
                      onClick={() => { setPreviewDataUrl(null); setSelectedQuoteRequest(null); }}
                      className="mb-4"
                    >
                      ← Back to Quotations
                    </Button>

                    <div className="grid grid-cols-3 gap-6 w-full" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '24px', height: 'calc(100vh - 200px)', maxHeight: 'calc(100vh - 200px)' }}>
                      {/* Left: Lead Details */}
                      <aside className="col-span-1 border rounded bg-white dark:bg-slate-800 p-4 overflow-y-auto min-w-0" style={{ minWidth: 0, overflow: 'auto' }}>
                        <h3 className="font-semibold mb-4 text-sm">Agent Lead Details</h3>
                        <div className="space-y-3 text-sm">
                          <div className="bg-slate-50 dark:bg-slate-900 p-2 rounded">
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">CLIENT INFO</p>
                            <div className="mt-2 space-y-2">
                              <div>
                                <p className="text-xs text-slate-500">Name</p>
                                <p className="font-medium">{selectedQuoteRequest.leadClientName || '—'}</p>
                              </div>
                              <div>
                                <p className="text-xs text-slate-500">Phone</p>
                                <p className="font-medium">{selectedQuoteRequest.leadPhone || '—'}</p>
                              </div>
                              <div>
                                <p className="text-xs text-slate-500">Email</p>
                                <p className="font-medium text-blue-600 break-all text-xs">{selectedQuoteRequest.leadEmail || '—'}</p>
                              </div>
                            </div>
                          </div>

                          {(selectedQuoteRequest.requestedByName || selectedQuoteRequest.requestedBy) && (
                            <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 p-2 rounded">
                              <p className="text-xs text-blue-800 dark:text-blue-300 font-semibold">Requested By Agent</p>
                              <p className="text-xs text-blue-900 dark:text-blue-200 mt-1">{selectedQuoteRequest.requestedByName || selectedQuoteRequest.requestedBy || '—'}</p>
                            </div>
                          )}

                          <div className="bg-slate-50 dark:bg-slate-900 p-2 rounded">
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">TRIP DETAILS</p>
                            <div className="mt-2 space-y-2">
                              <div>
                                <p className="text-xs text-slate-500">Destination</p>
                                <p className="font-medium">
                                  {Array.isArray(selectedQuoteRequest.leadDestinations)
                                    ? selectedQuoteRequest.leadDestinations.join(', ')
                                    : selectedQuoteRequest.leadDestination || '—'}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-slate-500">Travel Date</p>
                                <p className="font-medium text-xs">
                                  {typeof selectedQuoteRequest.leadTravelDates === 'string'
                                    ? selectedQuoteRequest.leadTravelDates
                                    : selectedQuoteRequest.leadTravelDates?.from && selectedQuoteRequest.leadTravelDates?.to
                                    ? `${selectedQuoteRequest.leadTravelDates.from} - ${selectedQuoteRequest.leadTravelDates.to}`
                                    : '—'}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-slate-500">Persons</p>
                                <p className="font-medium">{selectedQuoteRequest.leadPersons || '—'}</p>
                              </div>
                              <div>
                                <p className="text-xs text-slate-500">Budget</p>
                                <p className="font-medium">Rs. {selectedQuoteRequest.leadBudget?.toLocaleString() || '—'}</p>
                              </div>
                            </div>
                          </div>

                          {(selectedQuoteRequest.leadRemarks || selectedQuoteRequest.leadAgentRemarks || selectedQuoteRequest.leadSpecialRequests || selectedQuoteRequest.leadTourType || selectedQuoteRequest.leadSource || selectedQuoteRequest.leadStatus || selectedQuoteRequest.leadLeadOutcome || selectedQuoteRequest.leadIslamabadStay || selectedQuoteRequest.leadAdults != null || selectedQuoteRequest.leadKids != null || selectedQuoteRequest.leadSeniors != null) && (
                            <div className="bg-slate-50 dark:bg-slate-900 p-2 rounded">
                              <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">PREFERENCES & DETAILS</p>
                              <div className="mt-2 space-y-2">
                                {selectedQuoteRequest.leadTourType && (
                                  <div>
                                    <p className="text-xs text-slate-500">Tour Type</p>
                                    <p className="font-medium text-xs">{selectedQuoteRequest.leadTourType}</p>
                                  </div>
                                )}
                                {selectedQuoteRequest.leadSource && (
                                  <div>
                                    <p className="text-xs text-slate-500">Source</p>
                                    <p className="font-medium text-xs">{selectedQuoteRequest.leadSource}</p>
                                  </div>
                                )}
                                {selectedQuoteRequest.leadStatus && (
                                  <div>
                                    <p className="text-xs text-slate-500">Lead Status</p>
                                    <p className="font-medium text-xs">{selectedQuoteRequest.leadStatus}</p>
                                  </div>
                                )}
                                {selectedQuoteRequest.leadLeadOutcome && (
                                  <div>
                                    <p className="text-xs text-slate-500">Lead Outcome</p>
                                    <p className="font-medium text-xs">{selectedQuoteRequest.leadLeadOutcome}</p>
                                  </div>
                                )}
                                {selectedQuoteRequest.leadIslamabadStay && (
                                  <div>
                                    <p className="text-xs text-slate-500">Islamabad Stay</p>
                                    <p className="font-medium text-xs">{selectedQuoteRequest.leadIslamabadStay}</p>
                                  </div>
                                )}
                                {(selectedQuoteRequest.leadAdults != null || selectedQuoteRequest.leadKids != null || selectedQuoteRequest.leadSeniors != null) && (
                                  <div>
                                    <p className="text-xs text-slate-500">Party Composition</p>
                                    <p className="font-medium text-xs">
                                      {selectedQuoteRequest.leadAdults ?? 0} adults
                                      {selectedQuoteRequest.leadKids != null ? `, ${selectedQuoteRequest.leadKids} kids` : ''}
                                      {selectedQuoteRequest.leadSeniors != null ? `, ${selectedQuoteRequest.leadSeniors} seniors` : ''}
                                    </p>
                                  </div>
                                )}
                                {selectedQuoteRequest.leadSpecialRequests && (
                                  <div>
                                    <p className="text-xs text-slate-500">Special Requests</p>
                                    <p className="font-medium text-xs">{selectedQuoteRequest.leadSpecialRequests}</p>
                                  </div>
                                )}
                                {selectedQuoteRequest.leadAgentRemarks && (
                                  <div className="border-t border-slate-300 dark:border-slate-600 pt-2">
                                    <p className="text-xs text-yellow-700 dark:text-yellow-300 font-semibold">Agent Remarks</p>
                                    <p className="text-xs text-yellow-900 dark:text-yellow-200 mt-1">{selectedQuoteRequest.leadAgentRemarks}</p>
                                  </div>
                                )}
                                {selectedQuoteRequest.leadRemarks && (
                                  <div className="border-t border-slate-300 dark:border-slate-600 pt-2">
                                    <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">Lead Notes</p>
                                    <p className="text-xs text-slate-800 dark:text-slate-200 mt-1">{selectedQuoteRequest.leadRemarks}</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </aside>

                      {/* Middle: Quotation Form */}
                      <main className="col-span-1 border rounded bg-white dark:bg-slate-800 p-4 min-w-0 overflow-hidden flex flex-col" style={{ minWidth: 0, display: 'flex', flexDirection: 'column', height: '100%' }}>
                        <QuoteInvoicePage
                          key={selectedQuoteRequest.id}
                          leadId={selectedQuoteRequest.leadId}
                          embedded={true}
                          leadData={memoizedManagerQuotationLeadData}
                          requestId={selectedQuoteRequest.id}
                          requestType={selectedQuoteRequest.requestType}
                          requestStatus={selectedQuoteRequest.status as any}
                          initialDocumentData={selectedQuoteRequest.documentData}
                          initialQuotationNumber={selectedQuoteRequest.quotationNumber}
                          onSaved={() => {
                            setSelectedQuoteRequest(null);
                            setCurrentPage('manager-quotations');
                          }}
                          onClose={() => setSelectedQuoteRequest(null)}
                          viewOnly={false}
                          generatePreviewOnMount
                          onPreviewGenerated={handlePreviewGenerated}
                          hidePreview={true}
                        />
                      </main>

                      {/* Right: Preview */}
                      <aside className="col-span-1 border rounded bg-white dark:bg-slate-800 p-4 flex flex-col overflow-hidden min-w-0" style={{ minWidth: 0 }}>
                        <h3 className="font-semibold mb-3 text-base flex-shrink-0">Preview</h3>
                        <div className="flex-1 overflow-auto flex items-center justify-center bg-slate-50 dark:bg-slate-900 rounded mb-3">
                          {previewDataUrl ? (
                            <img src={previewDataUrl} alt="Quotation preview" className="w-full max-h-full object-contain rounded" />
                          ) : (
                            <div className="text-sm text-slate-500">Generating preview…</div>
                          )}
                        </div>
                        <div className="flex flex-col gap-2 flex-shrink-0">
                          <button className="btn-secondary text-sm py-2 px-3" onClick={() => window.dispatchEvent(new Event('generate-quote-preview'))}>Regenerate</button>
                          {previewDataUrl && (
                            <a className="btn-primary text-center text-sm py-2 px-3 rounded" href={previewDataUrl} download={`${selectedQuoteRequest.requestType || 'quotation'}-preview.jpeg`}>Download JPEG</a>
                          )}
                        </div>
                      </aside>
                    </div>
                  </div>
                ) : (
                  <ManagerQuotationsPanel onSelectRequest={(request) => {
                    setSelectedQuoteRequest(request);
                  }} />
                )}
              </div>
            )}

            {currentPage === 'hotels' && (user?.role === 'admin' || user?.role === 'manager') && (
              <HotelsPanel />
            )}

            {activeAlarm && (
              <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border-2 border-red-500 p-5 shadow-2xl animate-pulse">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm uppercase tracking-wide text-red-500 font-semibold">Follow Up Alert</p>
                      <h3 className="text-2xl font-bold mt-1">This lead has follow up, do follow up</h3>
                      <p className="mt-2 text-slate-600 dark:text-slate-300">
                        {activeAlarm.clientName
                          ? `${activeAlarm.clientName}${activeAlarm.phone ? ` · ${activeAlarm.phone}` : ''}`
                          : activeFollowUpLead?.phone
                            ? `Phone: ${activeFollowUpLead.phone}`
                            : activeAlarm.phone
                              ? `Phone: ${activeAlarm.phone}`
                              : `Lead ID: ${activeAlarm.leadId}`}
                      </p>
                      {activeAlarm.createdByName && (
                        <p className="text-sm mt-1 text-slate-500 dark:text-slate-400">Created by {activeAlarm.createdByName}</p>
                      )}
                      <p className="text-sm mt-1 text-slate-500 dark:text-slate-400">
                        Due at {formatKarachiDateTime(activeAlarm.dueDate)}
                      </p>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Button variant="primary" onClick={() => { void completeActiveFollowUp(activeAlarm); }}>
                        Mark Complete
                      </Button>
                      <Button variant="secondary" onClick={() => dismissFollowUp(activeAlarm)}>
                        Dismiss
                      </Button>
                    </div>
                  </div>
                  <div className="mt-4 rounded-lg bg-red-50 dark:bg-red-950/30 p-3 text-sm text-red-700 dark:text-red-200">
                    Alarm sound will keep playing until you dismiss this alert or mark the follow up complete.
                  </div>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
};

export default App;
