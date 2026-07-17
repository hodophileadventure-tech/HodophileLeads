import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { leadsAPI, followUpsAPI, attachmentsAPI, adminAPI, quoteRequestsAPI } from '../utils/api-service';
import { LeadForm } from './LeadForm';
import ConfirmedLeadForm from './ConfirmedLeadForm';
import { PendingQuotesPanel } from './PendingQuotesPanel';
import { Badge, Button } from './common';
import type { Lead, FollowUp, QuoteRequest } from '../types';
import { formatKarachiFollowUpReminder, getKarachiLocalDateTimeString, getLeadLifecycleState, getLeadLifecycleStyle, parseKarachiDateTimeToISOString, calculateLeadDataHealth, getDataHealthColor } from '../utils/helpers';
import { normalizeFollowUp } from '../utils/followup-utils';
import { QuoteInvoicePage } from '../pages/QuoteInvoicePage';
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

export const AgentPanel: React.FC = () => {
  const { user } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [showAttachmentsModal, setShowAttachmentsModal] = useState(false);
  const [showConfirmForm, setShowConfirmForm] = useState(false);
  const [showFollowUpModal, setShowFollowUpModal] = useState(false);
  const [followUpLead, setFollowUpLead] = useState<Lead | null>(null);
  const [showCompletionRemarkModal, setShowCompletionRemarkModal] = useState(false);
  const [completionFollowUp, setCompletionFollowUp] = useState<FollowUp | null>(null);
  const [completionRemarks, setCompletionRemarks] = useState('');
  const quotePanelRef = useRef<HTMLDivElement | null>(null);
  const [followUpTitle, setFollowUpTitle] = useState('Follow up with client');
  const [followUpNote, setFollowUpNote] = useState('');
  const [followUpDateTime, setFollowUpDateTime] = useState('');
  const [activeAlarm, setActiveAlarm] = useState<FollowUp | null>(null);
  const [dismissedFollowUps, setDismissedFollowUps] = useState<Record<string, number>>(() => readDismissedFollowUps());
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMode, setSearchMode] = useState<'phone' | 'agent'>('phone');
  const [dateRangeStart, setDateRangeStart] = useState('');
  const [dateRangeEnd, setDateRangeEnd] = useState('');
  const [appliedDateRange, setAppliedDateRange] = useState<{ startDate: string; endDate: string }>({ startDate: '', endDate: '' });
  const [openSearchLeadForm, setOpenSearchLeadForm] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'potential' | 'in_progress' | 'dead' | 'confirmed' | 'canceled' | 'spam'>('all');
  const [quoteRequests, setQuoteRequests] = useState<QuoteRequest[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<QuoteRequest | null>(null);
  const [loadingSelectedRequest, setLoadingSelectedRequest] = useState(false);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [loadingQuoteRequests, setLoadingQuoteRequests] = useState(false);
  const [quoteRequestError, setQuoteRequestError] = useState('');
  const [screenShareStatus, setScreenShareStatus] = useState<'idle' | 'requesting' | 'active' | 'error'>('idle');
  const [screenShareError, setScreenShareError] = useState('');
  const [screenShareNotice, setScreenShareNotice] = useState('');
  const alarmAudioRef = useRef<HTMLAudioElement | null>(null);
  const screenVideoRef = useRef<HTMLVideoElement | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);

  const stopAlarmAudio = () => {
    try {
      alarmAudioRef.current?.pause();
      if (alarmAudioRef.current) alarmAudioRef.current.currentTime = 0;
    } catch {
      // ignore audio cleanup errors
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

  const getFollowUpTimeRemaining = (dueDate: string) => {
    const dueAt = new Date(dueDate).getTime();
    if (Number.isNaN(dueAt)) return 'Follow-up scheduled';
    const diffMs = dueAt - Date.now();
    if (diffMs <= 0) return 'Follow-up overdue';

    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) {
      return `in ${days}d ${hours}h`;
    }
    if (hours > 0) {
      return `in ${hours}h ${minutes}m`;
    }
    return `in ${minutes}m`;
  };

  const upcomingFollowUpsByLead = useMemo(() => {
    const map = new Map<string, FollowUp>();
    followUps
      .filter((item) => item.status !== 'completed' && item.status !== 'canceled')
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
      .forEach((item) => {
        if (!map.has(item.leadId)) {
          map.set(item.leadId, item);
        }
      });
    return map;
  }, [followUps]);

  const getFollowUpBadge = (lead: Lead) => {
    const followUp = upcomingFollowUpsByLead.get(String(lead.id));
    if (!followUp) return null;
    return (
      <span className="inline-flex items-center rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 px-2 py-1 text-xs font-medium">
        Follow-up scheduled • {getFollowUpTimeRemaining(followUp.dueDate)}
      </span>
    );
  };

  const stopScreenCapture = () => {
    const stream = screenStreamRef.current;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }

    screenStreamRef.current = null;
    if (screenVideoRef.current) {
      screenVideoRef.current.srcObject = null;
    }

    setScreenShareStatus('idle');
    setScreenShareError('');
    setScreenShareNotice('Screen capture stopped.');
  };

  const startScreenCapture = async () => {
    try {
      if (!navigator.mediaDevices?.getDisplayMedia) {
        throw new Error('Screen capture is not supported in this browser');
      }

      setScreenShareStatus('requesting');
      setScreenShareError('');
      setScreenShareNotice('');

      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      screenStreamRef.current = stream;
      setScreenShareStatus('active');
      setScreenShareNotice('Screen capture is enabled. Admin can request screenshots now.');

      if (screenVideoRef.current) {
        screenVideoRef.current.srcObject = stream;
        await screenVideoRef.current.play().catch(() => undefined);
      }

      stream.getVideoTracks()[0]?.addEventListener('ended', () => {
        stopScreenCapture();
      });
    } catch (error: any) {
      setScreenShareStatus('error');
      setScreenShareError(error?.message || 'Failed to start screen capture');
    }
  };

  const completeActiveFollowUp = async (item: FollowUp | null) => {
    if (!item) return;
    stopAlarmAudio();
    setActiveAlarm(null);
    setCompletionFollowUp(item);
    setCompletionRemarks('');
    setShowCompletionRemarkModal(true);
  };

  const confirmCompleteFollowUp = async () => {
    if (!completionFollowUp) return;
    try {
      console.log('Completing follow-up:', completionFollowUp.id, 'with remarks:', completionRemarks);
      const response = await followUpsAPI.complete(completionFollowUp.id, completionRemarks);
      console.log('Follow-up completed successfully:', response);
      
      const next = { ...readDismissedFollowUps(), [completionFollowUp.id]: Date.now() + 24 * 60 * 60 * 1000 };
      setDismissedFollowUps(next);
      writeDismissedFollowUps(next);
      setActiveAlarm(null);
      setShowCompletionRemarkModal(false);
      setCompletionFollowUp(null);
      setCompletionRemarks('');
      
      // Reload leads to show updated remarks
      await loadLeads();
      
      window.dispatchEvent(new Event('followups-updated'));
    } catch (error) {
      console.error('Failed to complete follow-up:', error);
      alert('Failed to mark follow-up complete: ' + (error instanceof Error ? error.message : String(error)));
    }
  };

  const loadLeads = async (filters?: { phone?: string; startDate?: string; endDate?: string }) => {
    try {
      const res = await leadsAPI.list(undefined, {
        phone: filters?.phone ?? (searchQuery.trim() || undefined),
        startDate: filters?.startDate ?? (appliedDateRange.startDate || undefined),
        endDate: filters?.endDate ?? (appliedDateRange.endDate || undefined)
      });
      setLeads(res.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const loadFollowUps = async () => {
    try {
      const response = await followUpsAPI.list();
      setFollowUps((response.data || []).map(normalizeFollowUp));
    } catch (err) {
      console.error('Failed to load follow-ups:', err);
    }
  };

  const loadQuoteRequests = async () => {
    try {
      setLoadingQuoteRequests(true);
      const res = await quoteRequestsAPI.list();
      setQuoteRequests(res.data || []);
      setQuoteRequestError('');
    } catch (err) {
      console.error(err);
      setQuoteRequestError('Unable to load saved quotations.');
    } finally {
      setLoadingQuoteRequests(false);
    }
  };

  useEffect(() => {
    loadLeads();
    loadFollowUps();
    loadQuoteRequests();
  }, [user?.role]);

  useEffect(() => {
    const handleFollowUpsUpdated = () => {
      void loadFollowUps();
    };

    window.addEventListener('followups-updated', handleFollowUpsUpdated);
    return () => window.removeEventListener('followups-updated', handleFollowUpsUpdated);
  }, []);

  useEffect(() => {
    const handleScreenshotRequest = async (event: Event) => {
      const detail = (event as CustomEvent).detail as { requestId?: string } | undefined;
      const requestId = detail?.requestId;

      if (!requestId) {
        return;
      }

      if (screenShareStatus !== 'active' || !screenStreamRef.current || !screenVideoRef.current) {
        try {
          await (adminAPI as any).submitScreenCapture(requestId, {
            error: 'Screen capture is not active yet. Please enable it first.',
            capturedAt: new Date().toISOString()
          });
        } catch (error) {
          console.error('Failed to submit screenshot error response', error);
        }
        return;
      }

      try {
        const video = screenVideoRef.current;
        if (!video.videoWidth || !video.videoHeight) {
          await new Promise<void>((resolve) => {
            const timeout = window.setTimeout(() => resolve(), 300);
            const onLoaded = () => {
              window.clearTimeout(timeout);
              resolve();
            };
            video.addEventListener('loadedmetadata', onLoaded, { once: true });
          });
        }

        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 1280;
        canvas.height = video.videoHeight || 720;
        const context = canvas.getContext('2d');

        if (!context) {
          throw new Error('Could not access capture canvas');
        }

        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/png');

        await (adminAPI as any).submitScreenCapture(requestId, {
          dataUrl,
          capturedAt: new Date().toISOString()
        });
        setScreenShareNotice(`Screenshot sent at ${new Date().toLocaleTimeString()}`);
      } catch (error: any) {
        try {
          await (adminAPI as any).submitScreenCapture(requestId, {
            error: error?.message || 'Failed to capture screenshot',
            capturedAt: new Date().toISOString()
          });
        } catch (submitError) {
          console.error('Failed to submit screenshot error response', submitError);
        }
      }
    };

    window.addEventListener('screen-capture-request', handleScreenshotRequest as EventListener);
    return () => {
      window.removeEventListener('screen-capture-request', handleScreenshotRequest as EventListener);
    };
  }, [screenShareStatus]);

  useEffect(() => {
    const handleOpenSavedQuote = async (event: Event) => {
      const detail = (event as CustomEvent).detail as { requestId?: string } | undefined;
      const requestId = detail?.requestId;
      if (!requestId) return;

      const existing = quoteRequests.find((request) => request.id === requestId);
      if (existing && existing.documentData) {
        openQuotePreview(existing);
        return;
      }

      try {
        setLoadingSelectedRequest(true);
        const res = await quoteRequestsAPI.getById(requestId);
        if (res.data) {
          openQuotePreview(res.data);
        }
      } catch (error) {
        console.error('Failed to load saved quote request from notification', error);
      } finally {
        setLoadingSelectedRequest(false);
      }
    };

    window.addEventListener('open-saved-quote', handleOpenSavedQuote as EventListener);
    return () => {
      window.removeEventListener('open-saved-quote', handleOpenSavedQuote as EventListener);
    };
  }, [quoteRequests]);

  // Scroll to selected quote panel only after preview generation completes
  // This prevents scroll conflicts with html2canvas rendering
  useEffect(() => {
    if (!selectedRequest || !quotePanelRef.current) return;

    // Use a simple, direct scroll without conflicts
    const scrollTimer = window.setTimeout(() => {
      try {
        quotePanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } catch (err) {
        console.warn('Scroll to panel failed:', err);
      }
    }, 1500); // Wait for all rendering to complete

    return () => clearTimeout(scrollTimer);
  }, [selectedRequest?.id]);

  const openQuotePreview = (request: QuoteRequest) => {
    window.dispatchEvent(new CustomEvent('open-quote-preview', { detail: { request } }));
  };

  const selectSavedRequest = async (request: QuoteRequest) => {
    try {
      setLoadingSelectedRequest(true);
      const res = await quoteRequestsAPI.getById(request.id);
      const req = res?.data || request;
      
      // Ensure documentData is preserved from the original request if not returned by API
      const mergedRequest = {
        ...req,
        documentData: req.documentData || request.documentData,
      };

      if (user?.role === 'agent') {
        setPreviewDataUrl(null);
        setSelectedRequest(mergedRequest);
        return;
      }

      openQuotePreview(mergedRequest);
    } catch (error) {
      console.error('Failed to load saved quote details', error);
      if (user?.role === 'agent') {
        setSelectedRequest(request);
      } else {
        openQuotePreview(request);
      }
    } finally {
      setLoadingSelectedRequest(false);
    }
  };

  useEffect(() => {
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
      } catch (err) {
        console.error(err);
      }
    };

    void checkFollowUps();
    const id = window.setInterval(() => { void checkFollowUps(); }, 30000);
    return () => {
      mounted = false;
      window.clearInterval(id);
    };
  }, [activeAlarm, dismissedFollowUps]);

  useEffect(() => {
    if (!activeAlarm) {
      stopAlarmAudio();
      return;
    }

    if (!alarmAudioRef.current) {
      alarmAudioRef.current = new Audio('/followup-alarm.wav');
      alarmAudioRef.current.loop = true;
      alarmAudioRef.current.volume = 1;
    }

    void alarmAudioRef.current.play().catch(() => {});

    return () => {
      stopAlarmAudio();
    };
  }, [activeAlarm]);

  const handleNewLead = (lead: Lead) => {
    setLeads((prev) => {
      if (!lead.id) {
        return [lead, ...prev];
      }
      const existingIndex = prev.findIndex((item) => item.id === lead.id);
      if (existingIndex >= 0) {
        return prev.map((item) => (item.id === lead.id ? lead : item));
      }
      return [lead, ...prev];
    });
  };

  const isLeadReadyForConfirmation = (lead: Lead) => {
    const hotelInfo = lead.hotelInfo;
    const hotelOptions = lead.hotelOptions;
    const transport = lead.transportPreference;

    const hasHotel = Boolean(
      hotelInfo?.hotelName?.trim() &&
      hotelInfo?.roomType?.trim() &&
      hotelInfo?.checkIn?.trim() &&
      hotelInfo?.checkOut?.trim()
    ) ||
      (Array.isArray(hotelOptions) && hotelOptions.some((option) =>
        Boolean(
          option.hotelName?.trim() &&
          option.roomType?.trim() &&
          option.checkIn?.trim() &&
          option.checkOut?.trim()
        )
      ));

    const hasTransport = typeof transport === 'string' && transport.trim().length > 0;
    return hasHotel && hasTransport;
  };

  const updateLeadOutcome = async (lead: Lead, leadOutcome: 'confirmed' | 'budget_issue' | 'no_reply') => {
    try {
      if (leadOutcome === 'confirmed' && !isLeadReadyForConfirmation(lead)) {
        alert('Cannot confirm lead until hotel details and transport information are filled.');
        return;
      }

      const payload: any = { leadOutcome };
      if (leadOutcome === 'confirmed') {
        payload.pipelineStage = 'confirmed';
        payload.status = 'booked';
        payload.potential = false;
      }

      const response = await leadsAPI.update(String(lead.id), payload);
      const updated = response.data as Lead;
      setLeads((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      if (selectedLead?.id === lead.id) {
        setSelectedLead(updated);
      }
    } catch (error) {
      console.error('Failed to update lead outcome', error);
      alert('Failed to update lead outcome');
    }
  };

  const handleSearch = async () => {
    if (!searchQuery) return;
    if (searchMode === 'phone') {
      try {
        const res: any = await (leadsAPI as any).searchByPhone(searchQuery);
        const results: Lead[] = res.data || [];
        if (results.length > 0) {
          setSelectedLead(results[0]);
          setLeads(results);
        } else {
          setSelectedLead({ phone: searchQuery } as any);
        }
        setOpenSearchLeadForm(true);
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleApplyLeadFilters = async () => {
    const nextRange = { startDate: dateRangeStart, endDate: dateRangeEnd };
    setAppliedDateRange(nextRange);
    await loadLeads({ phone: searchQuery.trim() || undefined, ...nextRange });
  };

  const handleClearLeadFilters = async () => {
    setDateRangeStart('');
    setDateRangeEnd('');
    setAppliedDateRange({ startDate: '', endDate: '' });
    await loadLeads({ phone: searchQuery.trim() || undefined });
  };

  const openFollowUp = (lead: Lead) => {
    setFollowUpLead(lead);
    setFollowUpTitle(`Follow up with ${lead.clientName || 'client'}`);
    setFollowUpNote('');
    const defaultDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
    setFollowUpDateTime(getKarachiLocalDateTimeString(defaultDate));
    setShowFollowUpModal(true);
  };

  const openConfirm = (lead: Lead) => {
    setSelectedLead(lead);
    setShowConfirmForm(true);
  };

  const handleConfirmedSaved = (updated: Lead) => {
    setLeads((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
    setSelectedLead(updated);
    setShowConfirmForm(false);
  };

  const requestedInvoiceLeadIds = useMemo(() => {
    return new Set(
      quoteRequests
        .filter((request) => request.requestType === 'invoice')
        .map((request) => request.leadId)
    );
  }, [quoteRequests]);

  const requestLeadDocument = async (lead: Lead) => {
    const type = window.prompt('Enter document request type: quotation or invoice', 'quotation');
    if (!type) return;
    const normalizedType = type.trim().toLowerCase();
    if (normalizedType !== 'quotation' && normalizedType !== 'invoice') {
      alert('Please enter either quotation or invoice');
      return;
    }

    try {
      await leadsAPI.requestQuote(String(lead.id), normalizedType as 'quotation' | 'invoice');
      alert(`Requested ${normalizedType} for ${lead.clientName || lead.phone}. A manager will be notified.`);
      await loadQuoteRequests();
    } catch (error: any) {
      console.error('Failed to request document', error);
      const message = error?.response?.data?.message || error?.message || 'Unable to submit document request. Please try again.';
      alert(message);
    }
  };

  const deleteLead = async (lead: Lead) => {
    const confirmed = window.confirm(
      `Are you sure you want to permanently delete this lead (${lead.clientName})? This action cannot be undone.`
    );
    if (!confirmed) return;
    try {
      await leadsAPI.delete(String(lead.id));
      setLeads((prev) => prev.filter((l) => l.id !== lead.id));
      setSelectedLead(null);
      alert('Lead deleted successfully.');
    } catch (error) {
      console.error('Failed to delete lead:', error);
      alert('Failed to delete lead.');
    }
  };

  const normalizedSearch = searchQuery.trim().toLowerCase();
  const filteredLeads = leads.filter((lead) => {
    const leadDateValue = (lead as any).createdAt || (lead as any).created_at || '';
    const leadDateTime = leadDateValue ? new Date(leadDateValue).getTime() : 0;

    if (appliedDateRange.startDate) {
      const startBoundary = new Date(`${appliedDateRange.startDate}T00:00:00`).getTime();
      if (leadDateTime && leadDateTime < startBoundary) return false;
    }

    if (appliedDateRange.endDate) {
      const endBoundary = new Date(`${appliedDateRange.endDate}T23:59:59.999`).getTime();
      if (leadDateTime && leadDateTime > endBoundary) return false;
    }

    if (activeFilter !== 'all') {
      if (activeFilter === 'canceled') {
        if (String((lead as any).status || '').toLowerCase() !== 'canceled') return false;
      } else if (activeFilter === 'spam') {
        if (String((lead as any).status || '').toLowerCase() !== 'spam') return false;
      } else if (getLeadLifecycleState(lead) !== activeFilter) {
        return false;
      }
    }

    if (!normalizedSearch) return true;

    if (searchMode === 'phone') {
      return String(lead.phone || '').toLowerCase().includes(normalizedSearch);
    }

    const agentName = String((lead as any).agentName || (lead as any).agent_name || '').toLowerCase();
    const agentId = String(lead.agentId || '').toLowerCase();
    return agentId.includes(normalizedSearch) || agentName.includes(normalizedSearch);
  });

  const counts = {
    all: leads.length,
    potential: leads.filter((lead) => getLeadLifecycleState(lead) === 'potential').length,
    in_progress: leads.filter((lead) => getLeadLifecycleState(lead) === 'in_progress').length,
    dead: leads.filter((lead) => getLeadLifecycleState(lead) === 'dead').length,
    confirmed: leads.filter((lead) => getLeadLifecycleState(lead) === 'confirmed').length,
    spam: leads.filter((lead) => String((lead as any).status || '').toLowerCase() === 'spam').length,
    canceled: leads.filter((lead) => String((lead as any).status || '').toLowerCase() === 'canceled').length
  };

  return (
    <div className="space-y-4">
      {/* Sticky Quote Navigation - On Top */}
      <div className="sticky top-0 z-50 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 shadow-md rounded-lg">
        <div className="flex items-center gap-2 p-4">
          <button
            onClick={() => {
              const el = document.getElementById('pending-section');
              if (el) {
                requestAnimationFrame(() => {
                  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                });
              }
            }}
            className="px-4 py-2 rounded-lg font-medium transition-colors bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100 hover:bg-blue-200 dark:hover:bg-blue-800"
          >
            ↓ Pending Quotes
          </button>
          <button
            onClick={() => {
              const el = document.getElementById('created-section');
              if (el) {
                requestAnimationFrame(() => {
                  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                });
              }
            }}
            className="px-4 py-2 rounded-lg font-medium transition-colors bg-green-100 dark:bg-green-900 text-green-900 dark:text-green-100 hover:bg-green-200 dark:hover:bg-green-800"
          >
            ↓ Created Quotes
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold">Screen Snapshot Access</h3>
              <Badge color={screenShareStatus === 'active' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'}>
                {screenShareStatus === 'active' ? 'Active' : 'Off'}
              </Badge>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              You control when screen capture starts. When active, an admin can request a single screenshot at any time.
            </p>
          </div>
          <div className="flex gap-2">
            {screenShareStatus !== 'active' ? (
              <Button onClick={startScreenCapture} loading={screenShareStatus === 'requesting'}>
                Enable Screen Capture
              </Button>
            ) : (
              <Button variant="danger" onClick={stopScreenCapture}>Stop Sharing</Button>
            )}
          </div>
        </div>
        {screenShareError && <p className="mt-3 text-sm text-rose-600">{screenShareError}</p>}
        {screenShareNotice && <p className="mt-3 text-sm text-slate-500">{screenShareNotice}</p>}
        <video ref={screenVideoRef} className="hidden" muted playsInline />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex flex-col gap-2 md:flex-1">
          <div className="flex items-center gap-2">
            <select className="input-field" value={searchMode} onChange={(e) => setSearchMode(e.target.value as 'phone' | 'agent')}>
              <option value="phone">Search by Number</option>
              <option value="agent">Search by Agent</option>
            </select>
            <input
              className="input-field flex-1"
              placeholder={searchMode === 'phone' ? 'Search phone or enter to create' : 'Search by agent id or name'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-sm text-slate-600 dark:text-slate-400">From</label>
            <input type="date" className="input-field" value={dateRangeStart} onChange={(e) => setDateRangeStart(e.target.value)} />
            <label className="text-sm text-slate-600 dark:text-slate-400">To</label>
            <input type="date" className="input-field" value={dateRangeEnd} onChange={(e) => setDateRangeEnd(e.target.value)} />
            <Button onClick={() => void handleApplyLeadFilters()}>Apply</Button>
            <Button variant="secondary" onClick={() => void handleClearLeadFilters()}>Clear</Button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={handleSearch}>Search</Button>
          <Button variant="secondary" onClick={() => {
            const lines = filteredLeads.map((lead) => {
              const leadAny = lead as any;
              const createdAtValue = leadAny.createdAt || leadAny.created_at || '';
              const createdAtText = createdAtValue ? new Date(createdAtValue).toISOString() : '';
              return [
                lead.id,
                lead.clientName || '',
                lead.email || '',
                lead.phone || '',
                lead.destination || '',
                String((lead as any).status || ''),
                String((lead as any).temperature || ''),
                createdAtText,
              ].map((value) => String(value).replace(/\t/g, ' ')).join('\t');
            });
            if (!lines.length) {
              alert('No leads available to export.');
              return;
            }
            const header = 'Lead ID\tClient Name\tEmail\tPhone\tDestination\tStatus\tTemperature\tCreated At';
            const blob = new Blob([`${header}\n${lines.join('\n')}`], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `tripnexus-leads-${activeFilter}-${new Date().toISOString().slice(0, 10)}.txt`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
          }}>
            Export TXT
          </Button>
          <LeadForm
            onSuccess={handleNewLead}
            initialData={selectedLead || undefined}
            initiallyOpen={openSearchLeadForm}
            onOpenChange={(isOpen) => {
              if (!isOpen) {
                setOpenSearchLeadForm(false);
              }
            }}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          { key: 'all', label: `All (${counts.all})`, color: 'bg-slate-200 dark:bg-slate-700' },
          { key: 'potential', label: `Potential (${counts.potential})`, color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
          { key: 'in_progress', label: `In Progress (${counts.in_progress})`, color: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200' },
          { key: 'confirmed', label: `Confirmed (${counts.confirmed})`, color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
          { key: 'spam', label: `Spam (${counts.spam})`, color: 'bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200' },
          { key: 'dead', label: `Dead (${counts.dead})`, color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200' },
          { key: 'canceled', label: `Canceled (${counts.canceled})`, color: 'bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900 dark:text-fuchsia-200' }
        ].map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setActiveFilter(item.key as typeof activeFilter)}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${activeFilter === item.key ? item.color : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'}`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {filteredLeads.map((lead) => {
          const lifecycle = getLeadLifecycleStyle(lead);
          const dataHealth = calculateLeadDataHealth(lead);
          const healthColor = getDataHealthColor(dataHealth);
          return (
            <div
              key={lead.id}
              className={`p-3 border rounded flex items-center justify-between ${lifecycle.row}`}
            >
              <div>
                <div className="font-semibold flex items-center gap-2">
                  <span>{lead.clientName || 'Unnamed'}</span>
                  <Badge color={lifecycle.badge}>{lifecycle.label}</Badge>
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${healthColor.bg} ${healthColor.text}`}>
                    Data: {dataHealth}%
                  </span>
                </div>
                <div className="text-sm text-slate-500">{lead.phone} • {lead.destination}</div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="text-xs text-slate-500">Lead outcome:</span>
                  <select
                    className="input-field text-sm py-1 px-2 w-auto"
                    value={(lead as any).leadOutcome || ''}
                    onChange={(e) => {
                      if (!e.target.value) return;
                      void updateLeadOutcome(lead, e.target.value as 'confirmed' | 'budget_issue' | 'no_reply');
                    }}
                  >
                    <option value="">Set outcome</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="budget_issue">Budget issue</option>
                    <option value="no_reply">No reply</option>
                  </select>
                </div>
                <div className="mt-2">
                  {getFollowUpBadge(lead)}
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => setSelectedLead(lead)}>Edit</Button>
                <Button variant="secondary" onClick={async () => {
                    try {
                      const res = await attachmentsAPI.listByLead(String(lead.id));
                      setAttachments(res.data.attachments || []);
                      setShowAttachmentsModal(true);
                    } catch (err) {
                      console.error('Failed to load attachments', err);
                      alert('Failed to load attachments');
                    }
                  }}>Attachments</Button>
                <Button variant="secondary" onClick={() => openFollowUp(lead)}>Schedule Follow Up</Button>
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => requestLeadDocument(lead)}
                    disabled={requestedInvoiceLeadIds.has(lead.id)}
                  >
                    Request Quote/Invoice
                  </Button>
                  {requestedInvoiceLeadIds.has(lead.id) && (
                    <span className="inline-flex items-center rounded-full bg-orange-100 text-orange-800 px-3 py-1 text-xs font-semibold">
                      Invoice already requested
                    </span>
                  )}
                </div>
                {lifecycle.state !== 'confirmed' && (
                  <Button variant="primary" onClick={() => openConfirm(lead)}>Confirm</Button>
                )}
                <Button 
                  variant="danger" 
                  onClick={() => deleteLead(lead)}
                  className="bg-red-700 hover:bg-red-800 dark:bg-red-900 dark:hover:bg-red-950"
                >
                  Delete
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {selectedLead && !showConfirmForm && (
        <LeadForm
          initialData={selectedLead as Partial<Lead>}
          initiallyOpen={Boolean(selectedLead)}
          onSuccess={() => {
            // refresh
            loadLeads();
            setSelectedLead(null);
          }}
          onOpenChange={(isOpen) => {
            if (!isOpen) {
              setOpenSearchLeadForm(false);
              setSelectedLead(null);
            }
          }}
        />
      )}

      <section id="pending-section" style={{ scrollMarginTop: '120px' }}>
        <PendingQuotesPanel onSelectRequest={(request) => {
          if (request) openQuotePreview(request);
        }} />
      </section>

      <section id="created-section" className="card" style={{ scrollMarginTop: '120px' }}>
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4">
          <div>
            <h2 className="text-2xl font-semibold">Created Quotations</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">View quotations your admin has completed for your leads.</p>
          </div>
        </div>
        {loadingQuoteRequests ? (
          <p className="mt-4 text-sm text-slate-600">Loading created quotations...</p>
        ) : quoteRequestError ? (
          <p className="mt-4 text-sm text-rose-600">{quoteRequestError}</p>
        ) : quoteRequests.length === 0 ? (
          <p className="mt-4 text-sm text-slate-600">No created quotations have been completed yet.</p>
        ) : loadingQuoteRequests ? (
          <p className="mt-4 text-sm text-slate-600">Loading created quotations...</p>
        ) : (
          <div className="mt-4 space-y-3">
            {quoteRequests.map((request) => (
              <div
                key={request.id}
                className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
              >
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                  <div className="min-w-0 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 px-3 py-1 text-xs font-semibold uppercase">
                        {request.requestType === 'quotation' ? 'Quotation' : 'Invoice'}
                      </span>
                      <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200 px-3 py-1 text-xs font-semibold uppercase">
                        Created
                      </span>
                    </div>
                    <div>
                      <p className="font-semibold text-lg truncate">{request.leadClientName || request.leadPhone}</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">Requested by: {request.requestedByName || 'Unknown'}</p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm text-slate-600 dark:text-slate-300">
                      <div>
                        <p className="text-xs text-slate-400 dark:text-slate-500 uppercase tracking-[0.15em]">Phone</p>
                        <p className="font-medium mt-1">{request.leadPhone || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400 dark:text-slate-500 uppercase tracking-[0.15em]">Destination</p>
                        <p className="font-medium mt-1">{request.leadDestination || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400 dark:text-slate-500 uppercase tracking-[0.15em]">Created</p>
                        <p className="font-medium mt-1">{request.documentData?.date ? new Date(request.documentData.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-3 items-start sm:items-end">
                    {request.documentData?.quoteNumber ? (
                      <div className="text-right text-sm text-slate-500 dark:text-slate-400">
                        <div className="font-medium">Quote #</div>
                        <div>{request.quotationNumber || request.documentData?.quoteNumber}</div>
                      </div>
                    ) : null}
                    <Button variant="primary" size="sm" onClick={() => void selectSavedRequest(request)} disabled={loadingSelectedRequest}>
                      View Document
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {selectedRequest && (
        <section id="selected-quote-panel" className="card mt-6" ref={quotePanelRef} style={{ scrollMarginTop: '120px' }}>
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-4">
            <div>
              <h2 className="text-2xl font-semibold">Created {selectedRequest.requestType === 'quotation' ? 'Quotation' : 'Invoice'}</h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">{user?.role === 'admin' ? 'Admin completed' : 'View'} this document for {selectedRequest.leadClientName || selectedRequest.leadPhone}.</p>
            </div>
            <Button variant="secondary" onClick={() => { setPreviewDataUrl(null); setSelectedRequest(null); }}>
              Back to created quotations
            </Button>
          </div>

          {user?.role === 'agent' ? (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 max-h-[75vh]">
              <main className="col-span-1 md:col-span-9 overflow-y-auto">
                <QuoteInvoicePage
                  key={selectedRequest.id}
                  leadId={selectedRequest.leadId}
                  requestId={selectedRequest.id}
                  requestType={selectedRequest.requestType}
                  requestStatus={selectedRequest.status as any}
                  hidePreview={true}
                  leadData={{
                    clientName: selectedRequest.leadClientName,
                    phone: selectedRequest.leadPhone,
                    destination: selectedRequest.leadDestination,
                    travelDates: selectedRequest.leadTravelDates,
                    persons: selectedRequest.leadPersons,
                    address: '',
                  }}
                  initialDocumentData={selectedRequest.documentData}
                  initialQuotationNumber={selectedRequest.quotationNumber}
                  viewOnly={true}
                  generatePreviewOnMount
                  onPreviewGenerated={async (dataUrl) => {
                    try {
                      if (!dataUrl) {
                        setPreviewDataUrl(null);
                        return;
                      }

                      try {
                        const prev = previewDataUrl;
                        if (prev && prev.startsWith('blob:')) {
                          URL.revokeObjectURL(prev);
                        }
                      } catch (e) {
                        // ignore
                      }

                      setPreviewDataUrl(dataUrl);
                    } catch (err) {
                      console.error('Failed to set preview data URL:', err);
                      setPreviewDataUrl(null);
                    }
                  }}
                />
              </main>

              <aside className="col-span-1 md:col-span-3 flex flex-col overflow-hidden min-h-0">
                <div className="border rounded p-4 flex flex-col h-full min-h-0">
                  <h3 className="font-semibold mb-3 text-base flex-shrink-0">Preview</h3>
                  <div className="flex-1 min-h-[320px] overflow-auto flex items-center justify-center bg-slate-50 dark:bg-slate-800 rounded mb-3 p-2">
                    {previewDataUrl ? (
                      <img
                        src={previewDataUrl}
                        alt="Quotation preview"
                        className="max-h-full max-w-full object-contain rounded"
                        style={{ display: 'block' }}
                      />
                    ) : (
                      <div className="text-sm text-slate-500">Generating preview…</div>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 flex-shrink-0">
                    <Button variant="secondary" size="sm" onClick={() => window.dispatchEvent(new Event('generate-quote-preview'))}>Regenerate</Button>
                    {previewDataUrl && (
                      <button
                        className="btn-primary text-center text-sm py-2 px-3 rounded"
                        onClick={async () => {
                          try {
                            const res = await fetch(previewDataUrl);
                            const blob = await res.blob();
                            const url = URL.createObjectURL(blob);
                            const link = document.createElement('a');
                            link.href = url;
                            link.download = `${selectedRequest.requestType || 'quotation'}-preview.jpeg`;
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                            URL.revokeObjectURL(url);
                          } catch (err) {
                            console.error('Failed to download preview:', err);
                            alert('Failed to download preview image. Please try regenerating the preview.');
                          }
                        }}
                      >
                        Download JPEG
                      </button>
                    )}
                  </div>
                </div>
              </aside>
            </div>
          ) : (
            <QuoteInvoicePage
              leadId={selectedRequest.leadId}
              requestId={selectedRequest.id}
              requestType={selectedRequest.requestType}
              requestStatus={selectedRequest.status as any}
              initialDocumentData={selectedRequest.documentData}
              viewOnly={user?.role !== 'admin'}
            />
          )}
        </section>
      )}

      {selectedLead && showConfirmForm && (
        <ConfirmedLeadForm lead={selectedLead as Lead} isOpen={showConfirmForm} onClose={() => setShowConfirmForm(false)} onSaved={handleConfirmedSaved} />
      )}

      {showFollowUpModal && followUpLead && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-5 shadow-2xl">
            <h3 className="text-xl font-bold mb-1">Schedule Follow Up</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Set the reminder date and time for {followUpLead.clientName}.</p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Title</label>
                <input
                  className="input-field"
                  value={followUpTitle}
                  onChange={(e) => setFollowUpTitle(e.target.value)}
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
              <Button variant="secondary" onClick={() => setShowFollowUpModal(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={async () => {
                  if (!followUpTitle.trim()) {
                    alert('Please enter a follow-up title.');
                    return;
                  }
                  if (!followUpNote.trim()) {
                    alert('Please enter a note for the follow-up.');
                    return;
                  }
                  if (!followUpDateTime) {
                    alert('Please choose a follow-up date and time.');
                    return;
                  }

                  try {
                    const response = await followUpsAPI.create({
                      leadId: String(followUpLead.id),
                      title: followUpTitle.trim(),
                      description: followUpNote.trim(),
                      dueDate: parseKarachiDateTimeToISOString(followUpDateTime),
                      assignedTo: user?.id ?? '',
                      type: 'manual',
                      priority: 'high'
                    });
                    setShowFollowUpModal(false);
                    setFollowUpLead(null);
                    const created = normalizeFollowUp(response.data);
                    if (new Date(created.dueDate).getTime() - Date.now() <= 60 * 60 * 1000) {
                      setActiveAlarm(created);
                    }
                    window.dispatchEvent(new CustomEvent('followup-due', { detail: created }));
                    window.dispatchEvent(new Event('followups-updated'));
                  } catch (err) {
                    console.error(err);
                    alert('Failed to schedule follow up.');
                  }
                }}
              >
                Save Follow Up
              </Button>
            </div>
          </div>
        </div>
      )}

      {showAttachmentsModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold">Attachments</h3>
              <div>
                <Button variant="secondary" onClick={() => setShowAttachmentsModal(false)}>Close</Button>
              </div>
            </div>
            <div className="mt-4 space-y-3">
              {attachments.length === 0 && <div className="text-sm text-slate-500">No attachments found.</div>}
              {attachments.map((a) => {
                const url = `${window.location.origin}${a.url}`;
                return (
                  <div key={a.id} className="flex items-center justify-between border rounded p-3">
                    <div>
                      <div className="font-medium">{a.file_name}</div>
                      <div className="text-sm text-slate-500">{(a.size || 0)} bytes • {a.mime_type}</div>
                    </div>
                    <div className="flex gap-2">
                      <a href={url} target="_blank" rel="noreferrer" className="btn">Preview</a>
                      <a href={url} download={a.file_name} className="btn">Download</a>
                      <button
                        className="btn text-red-600"
                        onClick={async () => {
                          if (!confirm('Delete this attachment?')) return;
                          try {
                            await (attachmentsAPI as any).delete(String(selectedLead?.id), a.id);
                            setAttachments((prev) => prev.filter((x) => x.id !== a.id));
                          } catch (err) {
                            console.error('Failed to delete attachment', err);
                            alert('Failed to delete attachment');
                          }
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {showCompletionRemarkModal && completionFollowUp && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-5 shadow-2xl">
            <h3 className="text-xl font-bold mb-1">Mark Follow-up Complete</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Add remarks about this follow-up (optional). These will be saved to the lead.</p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Remarks / Notes</label>
                <textarea
                  className="w-full border border-slate-300 dark:border-slate-600 rounded-lg p-3 dark:bg-slate-800 dark:text-white"
                  rows={5}
                  placeholder="e.g., Client confirmed dates, requires hotel confirmation, waiting for payment..."
                  value={completionRemarks}
                  onChange={(e) => setCompletionRemarks(e.target.value)}
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button 
                variant="secondary" 
                onClick={() => {
                  setShowCompletionRemarkModal(false);
                  setCompletionFollowUp(null);
                  setCompletionRemarks('');
                }}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={confirmCompleteFollowUp}
              >
                Mark Complete
              </Button>
            </div>
          </div>
        </div>
      )}

      {activeAlarm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border-2 border-red-500 p-5 shadow-2xl animate-pulse">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-wide text-red-500 font-semibold">Follow Up Alert</p>
                <h3 className="text-2xl font-bold mt-1">This lead has follow up, do follow up</h3>
                <p className="mt-2 text-slate-600 dark:text-slate-300">{activeAlarm.title}</p>
                <p className="text-sm mt-1 text-slate-500 dark:text-slate-400">
                  {activeAlarm.clientName
                    ? `${activeAlarm.clientName}${activeAlarm.phone ? ` · ${activeAlarm.phone}` : ''}`
                    : activeAlarm.phone
                      ? `Phone: ${activeAlarm.phone}`
                      : `Lead ID: ${activeAlarm.leadId}`}
                </p>
                {activeAlarm.createdByName && (
                  <p className="text-sm mt-1 text-slate-500 dark:text-slate-400">Created by {activeAlarm.createdByName}</p>
                )}
                <p className="text-sm mt-1 text-slate-500 dark:text-slate-400">{formatKarachiFollowUpReminder(activeAlarm.dueDate)}</p>
              </div>
              <div className="flex flex-col gap-2">
                <Button variant="primary" onClick={() => { void completeActiveFollowUp(activeAlarm); }}>
                  Mark Complete
                </Button>
                <Button variant="secondary" onClick={() => dismissFollowUp(activeAlarm)}>Dismiss</Button>
              </div>
            </div>
            <div className="mt-4 rounded-lg bg-red-50 dark:bg-red-950/30 p-3 text-sm text-red-700 dark:text-red-200">
              Alarm sound will keep playing until you dismiss this alert or mark the follow up complete.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AgentPanel;
