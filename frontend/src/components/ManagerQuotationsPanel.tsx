import React, { useState, useEffect } from 'react';
import { quoteRequestsAPI } from '../utils/api-service';
import type { QuoteRequest } from '../types';

interface ManagerQuotationsPanelProps {
  onSelectRequest: (request: QuoteRequest) => void;
}

export const ManagerQuotationsPanel: React.FC<ManagerQuotationsPanelProps> = ({ onSelectRequest }) => {
  const [pendingRequests, setPendingRequests] = useState<QuoteRequest[]>([]);
  const [submittedRequests, setSubmittedRequests] = useState<QuoteRequest[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    loadRequests();
    
    // Listen for save and send-for-approval events
    const handleQuoteUpdate = () => {
      loadRequests();
    };
    
    window.addEventListener('quote-request-saved', handleQuoteUpdate);
    window.addEventListener('quote-request-sent-approval', handleQuoteUpdate);
    
    return () => {
      window.removeEventListener('quote-request-saved', handleQuoteUpdate);
      window.removeEventListener('quote-request-sent-approval', handleQuoteUpdate);
    };
  }, []);

  const loadRequests = async () => {
    try {
      setLoading(true);
      const response = await quoteRequestsAPI.listPendingForManager();
      const allRequests: QuoteRequest[] = response.data || [];
      
      // Separate pending (agent requested) and submitted (manager submitted to admin)
      setPendingRequests(allRequests.filter((request: QuoteRequest) => request.status === 'requested'));
      setSubmittedRequests(allRequests.filter((request: QuoteRequest) => ['saved', 'created', 'manager_pending', 'admin_pending', 'rejected'].includes(request.status)));
      setError(null);
    } catch (err) {
      console.error('Failed to load pending quotations:', err);
      setError('Failed to load pending quotations.');
      setPendingRequests([]);
      setSubmittedRequests([]);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    loadRequests();
  };

  const handleDelete = async (requestId: string, clientName: string) => {
    if (!window.confirm(`Are you sure you want to delete the quotation for ${clientName}? This action cannot be undone.`)) {
      return;
    }

    try {
      setDeletingId(requestId);
      await quoteRequestsAPI.delete(requestId);
      // Remove from state
      setPendingRequests(prev => prev.filter(r => r.id !== requestId));
      setSubmittedRequests(prev => prev.filter(r => r.id !== requestId));
    } catch (err) {
      console.error('Failed to delete quotation:', err);
      alert('Failed to delete quotation. Please try again.');
    } finally {
      setDeletingId(null);
    }
  };

  const renderRequestCard = (request: QuoteRequest) => (
    <div key={request.id} className="bg-white p-4 rounded-lg border border-gray-200 hover:border-blue-400 transition">
      <div className="flex justify-between items-start mb-3">
        <div>
          <h4 className="font-semibold text-gray-900">{request.leadClientName || 'Unknown Client'}</h4>
          <p className="text-sm text-gray-600">{request.leadPhone}</p>
          <p className="text-xs text-gray-500">Lead: {request.leadEmail}</p>
        </div>
        <span className={`px-2 py-1 rounded text-xs font-semibold ${
          request.status === 'requested' ? 'bg-blue-100 text-blue-800' :
          request.status === 'saved' || request.status === 'created' ? 'bg-amber-100 text-amber-800' :
          request.status === 'admin_pending' ? 'bg-yellow-100 text-yellow-800' :
          request.status === 'rejected' ? 'bg-red-100 text-red-800' :
          'bg-gray-100 text-gray-800'
        }`}>
          {request.status === 'requested' ? 'Pending' :
           request.status === 'saved' || request.status === 'created' ? 'Ready to Send' :
           request.status === 'admin_pending' ? 'Awaiting Approval' :
           request.status === 'rejected' ? 'Needs Revision' :
           request.status.charAt(0).toUpperCase() + request.status.slice(1)}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-3 text-sm">
        <div>
          <span className="text-gray-600">Destination:</span>
          <p className="font-medium">{Array.isArray(request.leadDestinations) 
            ? request.leadDestinations.join(', ') 
            : request.leadDestination}</p>
        </div>
        <div>
          <span className="text-gray-600">Budget:</span>
          <p className="font-medium">Rs. {request.leadBudget?.toLocaleString() || 'N/A'}</p>
        </div>
        <div>
          <span className="text-gray-600">Persons:</span>
          <p className="font-medium">{request.leadPersons}</p>
        </div>
        <div>
          <span className="text-gray-600">Type:</span>
          <p className="font-medium capitalize">{request.requestType}</p>
        </div>
      </div>

      {request.leadRemarks && (
        <div className="mb-3 p-2 bg-gray-50 rounded text-sm">
          <span className="text-gray-600">Remarks: </span>
          <p className="text-gray-800">{request.leadRemarks}</p>
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={() => onSelectRequest(request)}
          className="flex-1 px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition text-sm font-medium"
        >
          {request.status === 'requested' ? 'Create Quotation' : 'View/Edit'}
        </button>
        <button
          onClick={() => handleDelete(request.id, request.leadClientName || 'Unknown Client')}
          disabled={deletingId === request.id}
          className="px-3 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition text-sm font-medium disabled:bg-red-400 disabled:cursor-not-allowed"
          title="Delete quotation"
        >
          {deletingId === request.id ? 'Deleting...' : '🗑️ Delete'}
        </button>
      </div>
    </div>
  );

  const filterRequests = (requests: QuoteRequest[]) => {
    if (!searchQuery) return requests;
    const q = searchQuery.toLowerCase();
    return requests.filter(r =>
      (r.leadClientName?.toLowerCase() || '').includes(q) ||
      (r.leadPhone?.toLowerCase() || '').includes(q) ||
      (r.leadEmail?.toLowerCase() || '').includes(q)
    );
  };

  const filteredPending = filterRequests(pendingRequests);
  const filteredSubmitted = filterRequests(submittedRequests);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Manager Quotations</h2>
        <button
          onClick={handleRefresh}
          className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition"
        >
          🔄 Refresh
        </button>
      </div>

      <div>
        <input
          type="text"
          placeholder="Search by client name, phone, or email..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
        />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12">
          <p className="text-gray-600">Loading quotations...</p>
        </div>
      ) : (
        <>
          {/* Pending Requests - Awaiting Manager Action */}
          {filteredPending.length > 0 && (
            <section id="pending-section">
              <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-4">
                <h3 className="text-lg font-semibold text-blue-900">
                  Pending Agent Requests ({filteredPending.length})
                </h3>
                <p className="text-sm text-blue-800">Agents have requested quotations. Create and submit for admin approval.</p>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
                {filteredPending.map(request => renderRequestCard(request))}
              </div>
            </section>
          )}

          {/* Submitted Requests - Awaiting Admin Approval */}
          {filteredSubmitted.length > 0 && (
            <section id="submitted-section">
              <div className="bg-amber-50 border-l-4 border-amber-400 p-4 mb-4">
                <h3 className="text-lg font-semibold text-amber-900">
                  My Quotations ({filteredSubmitted.length})
                </h3>
                <p className="text-sm text-amber-800">Quotations you've saved or submitted for admin approval. Review before sending or make revisions.</p>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {filteredSubmitted.map(request => renderRequestCard(request))}
              </div>
            </section>
          )}

          {filteredPending.length === 0 && filteredSubmitted.length === 0 && (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <p className="text-gray-600 text-lg">
                {searchQuery ? 'No quotations match your search.' : 'No pending quotations. All caught up!'}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
};
