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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadRequests();

    const handleQuoteSaved = () => {
      loadRequests();
    };

    window.addEventListener('quote-request-saved', handleQuoteSaved as EventListener);
    return () => {
      window.removeEventListener('quote-request-saved', handleQuoteSaved as EventListener);
    };
  }, []);

  const loadRequests = async () => {
    try {
      setLoading(true);
      const response = await quoteRequestsAPI.list();
      const allRequests = response.data || [];
      setPendingRequests(allRequests.filter((request) => request.status === 'requested'));
      setSavedRequests(allRequests.filter((request) => request.status === 'saved'));
      setError(null);
    } catch (err) {
      console.error('Failed to load quote requests:', err);
      setError('Failed to load quote requests.');
      setPendingRequests([]);
      setSavedRequests([]);
    } finally {
      setLoading(false);
    }
  };

  const renderRequestCard = (request: QuoteRequest, actionLabel: string) => (
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
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
            Requested by: <span className="font-medium">{request.requestedByName || 'Unknown'}</span>
          </p>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Phone</p>
              <p className="font-medium">{request.leadPhone || 'N/A'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Destination</p>
              <p className="font-medium">{request.leadDestination || 'N/A'}</p>
            </div>
          </div>
        </div>
        <div className="text-right space-y-2">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {new Date(request.createdAt).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })}
          </p>
          <Button variant="primary" size="sm" onClick={() => onSelectRequest(request)}>
            {actionLabel}
          </Button>
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="card">
        <h2 className="text-2xl font-semibold mb-4">Pending Quote Requests</h2>
        <div className="text-center py-8 text-slate-500">
          <p>Loading quote data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <h2 className="text-2xl font-semibold mb-4">Pending Quote Requests</h2>
        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-lg">
          <p>{error}</p>
          <Button variant="primary" onClick={loadRequests} className="mt-4">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-semibold">Pending Quote Requests</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">These leads still need quotations or invoices to be generated.</p>
          </div>
          <span className="px-3 py-1 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 text-sm font-medium">
            {pendingRequests.length}
          </span>
        </div>

        {pendingRequests.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <p>No pending quote requests right now.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pendingRequests.map((request) => renderRequestCard(request, `Create ${request.requestType === 'quotation' ? 'Quotation' : 'Invoice'}`))}
          </div>
        )}
      </section>

      <section className="card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-semibold">Created Quotations</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">Leads for whom a quotation or invoice has already been created.</p>
          </div>
          <span className="px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm font-medium">
            {savedRequests.length}
          </span>
        </div>

        {savedRequests.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <p>No created quotations yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {savedRequests.map((request) => renderRequestCard(request, 'View Document'))}
          </div>
        )}
      </section>
    </div>
  );
};
