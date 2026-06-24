import React, { useState, useEffect } from 'react';
import { quoteRequestsAPI } from '../utils/api-service';
import type { QuoteRequest } from '../types';
import { Button } from './common';

interface PendingQuotesPanelProps {
  onSelectRequest: (request: QuoteRequest) => void;
}

export const PendingQuotesPanel: React.FC<PendingQuotesPanelProps> = ({ onSelectRequest }) => {
  const [pendingRequests, setPendingRequests] = useState<QuoteRequest[]>([]);
  const [savedRequests, setSavedRequests] = useState<QuoteRequest[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'pending' | 'saved'>('pending');

  useEffect(() => {
    loadRequests();

    const handleQuoteSaved = () => {
      loadRequests();
    };

    const handleJump = (e: Event) => {
      const ev = e as CustomEvent<any> | any;
      const target = ev?.detail;
      
      if (target === 'pending') {
        scrollToSection('pending');
      } else if (target === 'saved') {
        scrollToSection('saved');
      }
    };

    const handleFocusSearch = async (e: Event) => {
      const ev = e as CustomEvent<{ query?: string }>;
      if (ev?.detail?.query) {
        const q = ev.detail.query;
        setSearchQuery(q);
        try {
          const allRequests = await loadRequests();
          const ql = q.toLowerCase();
          const found = allRequests.find((r: QuoteRequest) => ((r.documentData?.quoteNumber ?? '') + ' ' + (r.leadClientName || '') + ' ' + (r.leadPhone || '')).toLowerCase().includes(ql));
          if (found) onSelectRequest(found);
        } catch (err) {
          // ignore
        }
      }
    };

    const handleScroll = () => {
      const pendingEl = document.getElementById('pending-section');
      const savedEl = document.getElementById('saved-section');
      
      if (!pendingEl || !savedEl) return;
      
      const pendingRect = pendingEl.getBoundingClientRect();
      const savedRect = savedEl.getBoundingClientRect();
      
      // Check which section is closer to the top of the viewport
      const pendingDist = Math.abs(pendingRect.top);
      const savedDist = Math.abs(savedRect.top);
      
      if (pendingDist < savedDist) {
        setActiveTab('pending');
      } else {
        setActiveTab('saved');
      }
    };

    window.addEventListener('quote-request-saved', handleQuoteSaved as EventListener);
    window.addEventListener('jump-to-quote-section', handleJump as EventListener);
    window.addEventListener('focus-quote-search', handleFocusSearch as EventListener);
    window.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
      window.removeEventListener('quote-request-saved', handleQuoteSaved as EventListener);
      window.removeEventListener('jump-to-quote-section', handleJump as EventListener);
      window.removeEventListener('focus-quote-search', handleFocusSearch as EventListener);
      window.removeEventListener('scroll', handleScroll);
    };
  }, [onSelectRequest]);

  const loadRequests = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await quoteRequestsAPI.listPending();
      const allRequests = response.data || [];
      setPendingRequests(allRequests.filter((request) => request.status === 'requested'));
      setSavedRequests(allRequests.filter((request) => request.status === 'saved'));
      return allRequests;
    } catch (err: any) {
      console.error('Failed to load quote requests:', err);
      const errorMsg = err?.response?.data?.message || err?.message || 'Failed to load quote requests.';
      setError(errorMsg);
      setPendingRequests([]);
      setSavedRequests([]);
      return [];
    } finally {
      setLoading(false);
    }
  };

  const scrollToSection = (section: 'pending' | 'saved') => {
    const el = document.getElementById(section === 'pending' ? 'pending-section' : 'saved-section');
    if (el) {
      setTimeout(() => {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setActiveTab(section);
      }, 50);
    }
  };

  const handleDelete = async (requestId: string) => {
    if (!window.confirm('Are you sure you want to delete this quote request? This action cannot be undone.')) {
      return;
    }

    try {
      setDeletingId(requestId);
      await quoteRequestsAPI.delete(requestId);
      setPendingRequests(pendingRequests.filter(r => r.id !== requestId));
      setSavedRequests(savedRequests.filter(r => r.id !== requestId));
    } catch (err) {
      console.error('Failed to delete quote request:', err);
      alert('Failed to delete quote request. Please try again.');
    } finally {
      setDeletingId(null);
    }
  };

  const renderRequestCard = (request: QuoteRequest, actionLabel: string, isPending: boolean = true) => (
    <div
      key={request.id}
      className="p-4 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition"
    >
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h3 className="font-semibold text-slate-900 dark:text-white">
              {request.leadClientName || 'Unknown Client'}
            </h3>
            <span className="px-2 py-1 rounded text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 capitalize">
              {request.requestType}
            </span>
            <span className="px-2 py-1 rounded text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 capitalize">
              {request.status === 'saved' ? 'Created' : 'Pending'}
            </span>
            {request.reRequestNotes && (
              <span className="px-2 py-1 rounded text-xs font-medium bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300">
                Re-requested
              </span>
            )}
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
            Requested by: <span className="font-medium">{request.requestedByName || 'Unknown'}</span>
          </p>
          {request.reRequestNotes && (
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-2 italic">
              Changes needed: {request.reRequestNotes}
            </p>
          )}
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Phone</p>
              <p className="font-medium">{request.leadPhone || 'N/A'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Destination</p>
              <p className="font-medium">{request.leadDestination || 'N/A'}</p>
            </div>
            {request.status === 'saved' && request.documentData?.date && (
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Created</p>
                <p className="font-medium">{new Date(request.documentData.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
              </div>
            )}
          </div>
        </div>
        <div className="text-right space-y-2 flex flex-col">
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Requested</p>
            <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
              {new Date(request.createdAt).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {new Date(request.createdAt).toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true,
              })}
            </p>
          </div>
          {isPending && (
            <Button variant="primary" size="sm" onClick={() => onSelectRequest(request)}>
              {actionLabel}
            </Button>
          )}
          {!isPending && (
            <>
              <Button variant="primary" size="sm" onClick={() => onSelectRequest(request)}>
                {actionLabel}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  const notes = window.prompt('What changes would you like to make to this quotation?', request.reRequestNotes || '');
                  if (notes) {
                    handleReRequest(request.id, notes);
                  }
                }}
                className="text-orange-600 dark:text-orange-400"
              >
                Re-request
              </Button>
            </>
          )}
          {isPending && (
            <Button
              variant="danger"
              size="sm"
              onClick={() => handleDelete(request.id)}
              disabled={deletingId === request.id}
              className="text-red-600 dark:text-red-400"
            >
              {deletingId === request.id ? 'Deleting...' : 'Delete'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );

  const handleReRequest = async (requestId: string, notes: string) => {
    try {
      await quoteRequestsAPI.reRequest(requestId, notes);
      alert('Re-request submitted. Admin will be notified.');
      loadRequests();
    } catch (err) {
      console.error('Failed to re-request quote:', err);
      alert('Failed to re-request quote. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Sticky Navigation Tabs */}
        <div className="sticky top-0 z-50 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="flex items-center gap-2 p-4">
            <button
              disabled
              className="px-4 py-2 rounded-lg font-medium opacity-50 cursor-not-allowed bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
            >
              ↓ Pending
            </button>
            <button
              disabled
              className="px-4 py-2 rounded-lg font-medium opacity-50 cursor-not-allowed bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
            >
              ↓ Saved
            </button>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <input
            aria-label="Search quotations"
            placeholder="Search by client, phone, or quote #"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="border rounded p-2 flex-1"
            disabled
          />
        </div>
        <div className="card">
          <h2 className="text-2xl font-semibold mb-4">Pending Quote Requests</h2>
          <div className="text-center py-8 text-slate-500">
            <p>Loading quote data...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        {/* Sticky Navigation Tabs */}
        <div className="sticky top-0 z-50 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="flex items-center gap-2 p-4">
            <button
              disabled
              className="px-4 py-2 rounded-lg font-medium opacity-50 cursor-not-allowed bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
            >
              ↓ Pending
            </button>
            <button
              disabled
              className="px-4 py-2 rounded-lg font-medium opacity-50 cursor-not-allowed bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
            >
              ↓ Saved
            </button>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <input
            aria-label="Search quotations"
            placeholder="Search by client, phone, or quote #"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="border rounded p-2 flex-1"
          />
        </div>
        <div className="card">
          <h2 className="text-2xl font-semibold mb-4">Pending Quote Requests</h2>
          <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-lg">
            <p>{error}</p>
            <Button variant="primary" onClick={loadRequests} className="mt-4">
              Retry
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" id="pending-quotes-panel" style={{ display: 'block' }}>
      {/* Sticky Navigation Tabs */}
      <div className="sticky top-0 z-50 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="flex items-center gap-2 p-4">
          <button
            onClick={() => scrollToSection('pending')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'pending'
                ? 'bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            ↓ Pending ({pendingRequests.length})
          </button>
          <button
            onClick={() => scrollToSection('saved')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'saved'
                ? 'bg-green-100 dark:bg-green-900 text-green-900 dark:text-green-100'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            ↓ Saved ({savedRequests.length})
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <input
          aria-label="Search quotations"
          placeholder="Search by client, phone, or quote #"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="border rounded p-2 flex-1"
        />
      </div>
      <section id="pending-section" className="card" style={{ display: 'block' }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-semibold">Pending Quote Requests</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">These leads still need quotations or invoices to be generated.</p>
          </div>
          <span className="px-3 py-1 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 text-sm font-medium">
            {pendingRequests.length}
          </span>
        </div>

        {pendingRequests.filter(r => {
            if (!searchQuery) return true;
            const q = searchQuery.toLowerCase();
            return (r.leadClientName || '').toLowerCase().includes(q) || (r.leadPhone || '').toLowerCase().includes(q) || (r.documentData?.quoteNumber ?? '').toLowerCase().includes(q);
          }).length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <p>No pending quote requests right now.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pendingRequests.filter(r => {
              if (!searchQuery) return true;
              const q = searchQuery.toLowerCase();
              return (r.leadClientName || '').toLowerCase().includes(q) || (r.leadPhone || '').toLowerCase().includes(q) || (r.documentData?.quoteNumber ?? '').toLowerCase().includes(q);
            }).map((request) => renderRequestCard(request, `Create ${request.requestType === 'quotation' ? 'Quotation' : 'Invoice'}`, true))}
          </div>
        )}
      </section>

      <section id="saved-section" className="card" style={{ display: 'block' }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-semibold">Created Quotations</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">Leads for whom a quotation or invoice has already been created.</p>
          </div>
          <span className="px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm font-medium">
            {savedRequests.length}
          </span>
        </div>

        {savedRequests.filter(r => {
            if (!searchQuery) return true;
            const q = searchQuery.toLowerCase();
            return (r.leadClientName || '').toLowerCase().includes(q) || (r.leadPhone || '').toLowerCase().includes(q) || (r.documentData?.quoteNumber ?? '').toLowerCase().includes(q);
          }).length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <p>No created quotations yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {savedRequests.filter(r => {
              if (!searchQuery) return true;
              const q = searchQuery.toLowerCase();
              return (r.leadClientName || '').toLowerCase().includes(q) || (r.leadPhone || '').toLowerCase().includes(q) || (r.documentData?.quoteNumber ?? '').toLowerCase().includes(q);
            }).map((request) => renderRequestCard(request, 'View Document', false))}
          </div>
        )}
      </section>
    </div>
  );
};
