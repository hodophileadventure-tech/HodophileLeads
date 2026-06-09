import React, { useState, useEffect } from 'react';
import { quoteRequestsAPI } from '../utils/api-service';
import type { QuoteRequest } from '../types';
import { Button } from './common';

interface PendingQuotesPanelProps {
  onSelectRequest: (request: QuoteRequest) => void;
}

export const PendingQuotesPanel: React.FC<PendingQuotesPanelProps> = ({ onSelectRequest }) => {
  const [requests, setRequests] = useState<QuoteRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPendingRequests();
  }, []);

  const loadPendingRequests = async () => {
    try {
      setLoading(true);
      const response = await quoteRequestsAPI.listPending();
      setRequests(response.data || []);
      setError(null);
    } catch (err) {
      console.error('Failed to load pending requests:', err);
      setError('Failed to load pending quote requests');
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="card">
        <h2 className="text-2xl font-semibold mb-4">Pending Quote Requests</h2>
        <div className="text-center py-8 text-slate-500">
          <p>Loading pending requests...</p>
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
          <Button variant="primary" onClick={loadPendingRequests} className="mt-4">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <div className="card">
        <h2 className="text-2xl font-semibold mb-4">Pending Quote Requests</h2>
        <div className="text-center py-8 text-slate-500">
          <p>No pending quote requests.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-semibold">Pending Quote Requests</h2>
        <span className="px-3 py-1 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 text-sm font-medium">
          {requests.length}
        </span>
      </div>

      <div className="space-y-2">
        {requests.map((request) => (
          <div
            key={request.id}
            className="p-4 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
            onClick={() => onSelectRequest(request)}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-slate-900 dark:text-white">
                    {request.leadClientName || 'Unknown Client'}
                  </h3>
                  <span className="px-2 py-1 rounded text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 capitalize">
                    {request.requestType}
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
              <div className="text-right">
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                  {new Date(request.createdAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </p>
                <Button variant="primary" size="sm" onClick={() => onSelectRequest(request)}>
                  Create {request.requestType === 'quotation' ? 'Quotation' : 'Invoice'}
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
