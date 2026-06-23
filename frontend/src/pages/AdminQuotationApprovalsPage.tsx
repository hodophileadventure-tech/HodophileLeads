import { useEffect, useState } from 'react';
import { quoteRequestsAPI } from '../utils/api-service';
import { QuoteInvoicePage } from './QuoteInvoicePage';
import { Button } from '../components/common';
import type { QuoteRequest } from '../types';

interface AdminQuotationApprovalsPageProps {
  selectedRequest?: QuoteRequest | null;
  onSelectRequest?: (request: QuoteRequest | null) => void;
  onRequestUpdated?: () => void;
}

export default function AdminQuotationApprovalsPage({
  selectedRequest,
  onSelectRequest,
  onRequestUpdated
}: AdminQuotationApprovalsPageProps) {
  const [pendingQuotations, setPendingQuotations] = useState<QuoteRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string>('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);

  useEffect(() => {
    loadPendingQuotations();
    const handler = () => loadPendingQuotations();
    window.addEventListener('quotation-approvals-updated', handler);
    return () => window.removeEventListener('quotation-approvals-updated', handler);
  }, []);

  const loadPendingQuotations = async () => {
    try {
      setLoading(true);
      const response = await quoteRequestsAPI.listPendingForAdmin();
      setPendingQuotations(response.data);
    } catch (error) {
      console.error('Failed to load pending quotations:', error);
      setMessage('Failed to load pending quotations');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (quotation: QuoteRequest) => {
    if (!window.confirm(`Approve ${quotation.requestType} for ${quotation.leadClientName}?`)) {
      return;
    }

    try {
      setMessage('Approving quotation...');
      await quoteRequestsAPI.approve(quotation.id);
      setMessage('✅ Quotation approved successfully!');
      setShowRejectForm(false);
      setRejectionReason('');
      onSelectRequest?.(null);
      loadPendingQuotations();
      onRequestUpdated?.();
      setTimeout(() => setMessage(''), 3000);
    } catch (error: any) {
      console.error('Failed to approve quotation:', error);
      setMessage(`Failed to approve: ${error?.response?.data?.message || 'Unknown error'}`);
    }
  };

  const handleReject = async (quotation: QuoteRequest) => {
    if (!rejectionReason.trim()) {
      setMessage('Please provide a rejection reason');
      return;
    }

    if (!window.confirm(`Reject ${quotation.requestType} for ${quotation.leadClientName}? Manager will be notified.`)) {
      return;
    }

    try {
      setMessage('Rejecting quotation...');
      await quoteRequestsAPI.reject(quotation.id, rejectionReason);
      setMessage('✅ Quotation rejected. Manager notified to revise.');
      setShowRejectForm(false);
      setRejectionReason('');
      onSelectRequest?.(null);
      loadPendingQuotations();
      onRequestUpdated?.();
      setTimeout(() => setMessage(''), 3000);
    } catch (error: any) {
      console.error('Failed to reject quotation:', error);
      setMessage(`Failed to reject: ${error?.response?.data?.message || 'Unknown error'}`);
    }
  };

  if (loading && pendingQuotations.length === 0) {
    return (
      <div className="card p-8 text-center">
        <p className="text-slate-600">Loading pending quotations...</p>
      </div>
    );
  }

  if (!selectedRequest) {
    return (
      <div className="grid grid-cols-1 gap-6">
        <div className="card">
          <h2 className="text-2xl font-bold mb-4">Quotation Approvals</h2>
          <p className="text-sm text-slate-600 mb-6">
            Review and approve/reject quotations sent by managers
          </p>

          {pendingQuotations.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 rounded">
              <p className="text-slate-600">✅ No pending quotations. All caught up!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingQuotations.map((quotation) => (
                <div
                  key={quotation.id}
                  className="border rounded p-4 hover:bg-slate-50 cursor-pointer transition"
                  onClick={() => onSelectRequest?.(quotation)}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-semibold text-lg">
                        {quotation.leadClientName || 'Unknown Client'}
                      </h3>
                      <p className="text-sm text-slate-600">
                        {quotation.requestType === 'quotation' ? '📋' : '🧾'} {quotation.requestType === 'quotation' ? 'Quotation' : 'Invoice'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-slate-500">{quotation.leadDestination}</p>
                      {quotation.documentData?.quoteNumber && (
                        <p className="font-mono text-sm font-semibold">{quotation.documentData.quoteNumber}</p>
                      )}
                    </div>
                  </div>
                  {quotation.managerNotes && (
                    <p className="text-sm text-slate-700 bg-blue-50 p-2 rounded mt-2">
                      <strong>Manager Notes:</strong> {quotation.managerNotes}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
      {/* Back Button */}
      <div className="col-span-full">
        <Button
          variant="secondary"
          onClick={() => onSelectRequest?.(null)}
        >
          ← Back to Approvals List
        </Button>
      </div>

      {/* Left: Lead Details */}
      <aside className="col-span-full md:col-span-3 border rounded bg-white dark:bg-slate-800 p-4">
        <h3 className="font-semibold mb-4 text-sm">Lead Details</h3>
        <div className="space-y-3 text-sm">
          <div className="bg-slate-50 dark:bg-slate-900 p-2 rounded">
            <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">CLIENT INFO</p>
            <div className="mt-2 space-y-2">
              <div>
                <p className="text-xs text-slate-500">Name</p>
                <p className="font-medium">{selectedRequest.leadClientName || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Phone</p>
                <p className="font-medium">{selectedRequest.leadPhone || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Email</p>
                <p className="font-medium text-blue-600 break-all text-xs">{selectedRequest.leadEmail || '—'}</p>
              </div>
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-900 p-2 rounded">
            <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">TRIP DETAILS</p>
            <div className="mt-2 space-y-2">
              <div>
                <p className="text-xs text-slate-500">Destination</p>
                <p className="font-medium">{selectedRequest.leadDestination || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Persons</p>
                <p className="font-medium">{selectedRequest.leadPersons || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Budget</p>
                <p className="font-medium">Rs. {selectedRequest.leadBudget?.toLocaleString() || '—'}</p>
              </div>
            </div>
          </div>

          {selectedRequest.managerNotes && (
            <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 p-2 rounded">
              <p className="text-xs text-blue-800 dark:text-blue-300 font-semibold mb-1">Manager Notes</p>
              <p className="text-xs text-blue-900 dark:text-blue-200">{selectedRequest.managerNotes}</p>
            </div>
          )}
        </div>
      </aside>

      {/* Middle: Quotation Preview */}
      <main className="col-span-full md:col-span-6">
        <QuoteInvoicePage
          key={selectedRequest.id}
          leadId={selectedRequest.leadId}
          requestId={selectedRequest.id}
          requestStatus={selectedRequest.status as any}
          viewOnly={true}
          generatePreviewOnMount
          leadData={{
            clientName: selectedRequest.leadClientName,
            phone: selectedRequest.leadPhone,
            destination: selectedRequest.leadDestination,
            travelDates: selectedRequest.leadTravelDates,
            persons: selectedRequest.leadPersons,
            address: '',
          }}
        />
      </main>

      {/* Right: Approval Actions */}
      <aside className="col-span-full md:col-span-3 border rounded bg-white dark:bg-slate-800 p-4">
        <h3 className="font-semibold mb-4">Admin Actions</h3>

        {message && (
          <div className="p-3 mb-4 bg-blue-50 text-blue-900 rounded text-sm border border-blue-200">
            {message}
          </div>
        )}

        {!showRejectForm ? (
          <div className="space-y-3">
            <button
              onClick={() => handleApprove(selectedRequest)}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded"
            >
              ✅ Approve Quotation
            </button>
            <button
              onClick={() => setShowRejectForm(true)}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded"
            >
              ❌ Reject & Send Back
            </button>
          </div>
        ) : (
          <div className="space-y-3 bg-red-50 p-3 rounded border border-red-200">
            <label className="block">
              <p className="text-sm font-semibold text-red-900 mb-2">Rejection Reason (required)</p>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Explain what needs to be revised..."
                className="w-full border rounded p-2 text-sm"
                rows={4}
              />
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => handleReject(selectedRequest)}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded text-sm"
              >
                Send Rejection
              </button>
              <button
                onClick={() => {
                  setShowRejectForm(false);
                  setRejectionReason('');
                }}
                className="flex-1 bg-slate-400 hover:bg-slate-500 text-white font-semibold py-2 px-4 rounded text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="mt-6 p-3 bg-slate-100 dark:bg-slate-700 rounded text-xs text-slate-700 dark:text-slate-300">
          <p><strong>Type:</strong> {selectedRequest.requestType}</p>
          <p><strong>Status:</strong> <span className="font-mono">{selectedRequest.status}</span></p>
          {selectedRequest.documentData?.quoteNumber && (
            <p><strong>Number:</strong> {selectedRequest.documentData.quoteNumber}</p>
          )}
        </div>
      </aside>
    </div>
  );
}
