import { useEffect, useMemo, useState } from 'react';
import { quoteRequestsAPI } from '../utils/api-service';
import { QuoteInvoicePage } from './QuoteInvoicePage';
import { Button, Modal } from '../components/common';
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
  const [showRepairModal, setShowRepairModal] = useState(false);
  const [repairSubtotal, setRepairSubtotal] = useState('');
  const [repairNote, setRepairNote] = useState('');
  const [repairConfirmed, setRepairConfirmed] = useState(false);
  const [repairLoading, setRepairLoading] = useState(false);

  const isInvalidForAcceptance = selectedRequest?.status === 'invalid_for_acceptance';

  const normalizedAmount = (value: unknown) => {
    const parsed = Number(String(value ?? '').replace(/[^0-9.\-]/g, ''));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  };

  const money = (value: unknown) => {
    const parsed = normalizedAmount(value);
    return parsed != null ? `Rs. ${parsed.toLocaleString()}` : '—';
  };

  const repairSourceSubtotal = useMemo(() => {
    if (!selectedRequest) return '';
    const pdfSubtotal = normalizedAmount(selectedRequest.documentData?.subtotal);
    const lastKnownSubtotal = normalizedAmount(
      selectedRequest.leadLatestRevisedPrice ?? selectedRequest.leadInitialPrice ?? selectedRequest.leadActualPrice
    );
    const seed = pdfSubtotal ?? lastKnownSubtotal;
    return seed != null ? String(seed) : '';
  }, [selectedRequest]);

  useEffect(() => {
    loadPendingQuotations();
    const handler = () => loadPendingQuotations();
    window.addEventListener('quotation-approvals-updated', handler);
    return () => window.removeEventListener('quotation-approvals-updated', handler);
  }, []);

  useEffect(() => {
    setShowRepairModal(Boolean(isInvalidForAcceptance));
    setRepairSubtotal(repairSourceSubtotal);
    setRepairNote('');
    setRepairConfirmed(false);
  }, [isInvalidForAcceptance, repairSourceSubtotal, selectedRequest?.id]);

  const loadPendingQuotations = async () => {
    try {
      setLoading(true);
      const response = await quoteRequestsAPI.listPendingForAdmin();
      const refreshedList = response.data;
      setPendingQuotations(refreshedList);
      if (selectedRequest) {
        const updatedSelected = refreshedList.find((q) => q.id === selectedRequest.id);
        if (updatedSelected) {
          onSelectRequest?.(updatedSelected);
        }
      }
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

  const handleMarkAccepted = async (quotation: QuoteRequest) => {
    if (quotation.status === 'invalid_for_acceptance') {
      setShowRepairModal(true);
      return;
    }

    if (!window.confirm(`Mark ${quotation.requestType} for ${quotation.leadClientName} as accepted?`)) {
      return;
    }

    try {
      setMessage('Marking quotation as accepted...');
      const response = await quoteRequestsAPI.markAccepted(quotation.id);
      setMessage('✅ Quotation accepted. Lead payment pricing updated.');
      window.dispatchEvent(new CustomEvent('lead-payment-pricing-updated', {
        detail: { leadId: quotation.leadId, lead: response.data }
      }));
      onRequestUpdated?.();
      loadPendingQuotations();
      setTimeout(() => setMessage(''), 3000);
    } catch (error: any) {
      console.error('Failed to mark quotation as accepted:', error);
      setMessage(`Failed to mark accepted: ${error?.response?.data?.message || 'Unknown error'}`);
    }
  };

  const handleRepairAndAccept = async () => {
    if (!selectedRequest) return;

    const parsedSubtotal = normalizedAmount(repairSubtotal);
    if (parsedSubtotal == null) {
      setMessage('Please enter a valid subtotal before acceptance');
      return;
    }

    if (!repairConfirmed) {
      setMessage('Please confirm the repaired subtotal before continuing');
      return;
    }

    try {
      setRepairLoading(true);
      setMessage('Repairing quotation subtotal...');
      await quoteRequestsAPI.fixAcceptanceSubtotal(selectedRequest.id, {
        subtotal: String(parsedSubtotal),
        confirmed: true,
        note: repairNote.trim() || undefined
      });
      setMessage('Repair saved. Accepting quotation...');
      const response = await quoteRequestsAPI.markAccepted(selectedRequest.id);
      setMessage('✅ Quotation repaired and accepted. Lead payment pricing updated.');
      setShowRepairModal(false);
      window.dispatchEvent(new CustomEvent('lead-payment-pricing-updated', {
        detail: { leadId: selectedRequest.leadId, lead: response.data }
      }));
      onRequestUpdated?.();
      loadPendingQuotations();
      setTimeout(() => setMessage(''), 3000);
    } catch (error: any) {
      console.error('Failed to repair/accept quotation:', error);
      setMessage(`Failed to repair or accept: ${error?.response?.data?.message || 'Unknown error'}`);
    } finally {
      setRepairLoading(false);
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
                        <p className="font-mono text-sm font-semibold">{quotation.quotationNumber || quotation.documentData?.quoteNumber}</p>
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
    <>
      <div className="grid grid-cols-3 gap-6 w-full" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '24px' }}>
      {/* Back Button */}
      <div className="col-span-3">
        <Button
          variant="secondary"
          onClick={() => onSelectRequest?.(null)}
        >
          ← Back to Approvals List
        </Button>
      </div>

      {/* Left: Lead Details */}
      <aside className="col-span-1 border rounded bg-white dark:bg-slate-800 p-4 min-w-0" style={{ minWidth: 0 }}>
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
          {(selectedRequest.leadAgentRemarks || selectedRequest.leadRemarks || selectedRequest.leadSpecialRequests || selectedRequest.leadTourType || selectedRequest.leadSource || selectedRequest.leadStatus || selectedRequest.leadLeadOutcome || selectedRequest.leadIslamabadStay || selectedRequest.leadAdults != null || selectedRequest.leadKids != null || selectedRequest.leadSeniors != null) && (
            <div className="bg-slate-50 dark:bg-slate-900 p-2 rounded">
              <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">Lead Form Details</p>
              <div className="mt-2 space-y-2">
                {selectedRequest.leadTourType && (
                  <div>
                    <p className="text-xs text-slate-500">Tour Type</p>
                    <p className="font-medium text-xs">{selectedRequest.leadTourType}</p>
                  </div>
                )}
                {selectedRequest.leadSource && (
                  <div>
                    <p className="text-xs text-slate-500">Source</p>
                    <p className="font-medium text-xs">{selectedRequest.leadSource}</p>
                  </div>
                )}
                {selectedRequest.leadStatus && (
                  <div>
                    <p className="text-xs text-slate-500">Lead Status</p>
                    <p className="font-medium text-xs">{selectedRequest.leadStatus}</p>
                  </div>
                )}
                {selectedRequest.leadLeadOutcome && (
                  <div>
                    <p className="text-xs text-slate-500">Lead Outcome</p>
                    <p className="font-medium text-xs">{selectedRequest.leadLeadOutcome}</p>
                  </div>
                )}
                {selectedRequest.leadIslamabadStay && (
                  <div>
                    <p className="text-xs text-slate-500">Islamabad Stay</p>
                    <p className="font-medium text-xs">{selectedRequest.leadIslamabadStay}</p>
                  </div>
                )}
                {(selectedRequest.leadAdults != null || selectedRequest.leadKids != null || selectedRequest.leadSeniors != null) && (
                  <div>
                    <p className="text-xs text-slate-500">Party Composition</p>
                    <p className="font-medium text-xs">
                      {selectedRequest.leadAdults ?? 0} adults
                      {selectedRequest.leadKids != null ? `, ${selectedRequest.leadKids} kids` : ''}
                      {selectedRequest.leadSeniors != null ? `, ${selectedRequest.leadSeniors} seniors` : ''}
                    </p>
                  </div>
                )}
                {selectedRequest.leadSpecialRequests && (
                  <div>
                    <p className="text-xs text-slate-500">Special Requests</p>
                    <p className="font-medium text-xs">{selectedRequest.leadSpecialRequests}</p>
                  </div>
                )}
                {selectedRequest.leadAgentRemarks && (
                  <div className="border-t border-slate-300 dark:border-slate-600 pt-2">
                    <p className="text-xs text-yellow-700 dark:text-yellow-300 font-semibold">Agent Remarks</p>
                    <p className="text-xs text-yellow-900 dark:text-yellow-200 mt-1">{selectedRequest.leadAgentRemarks}</p>
                  </div>
                )}
                {selectedRequest.leadRemarks && (
                  <div className="border-t border-slate-300 dark:border-slate-600 pt-2">
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">Lead Notes</p>
                    <p className="text-xs text-slate-800 dark:text-slate-200 mt-1">{selectedRequest.leadRemarks}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Middle: Quotation Preview */}
      <main className="col-span-1 border rounded bg-white dark:bg-slate-800 p-4 min-w-0" style={{ minWidth: 0 }}>
        <QuoteInvoicePage
          key={selectedRequest.id}
          leadId={selectedRequest.leadId}
          requestId={selectedRequest.id}
          requestType={selectedRequest.requestType}
          requestStatus={selectedRequest.status as any}
          initialDocumentData={selectedRequest.documentData}
          initialQuotationNumber={selectedRequest.quotationNumber}
          viewOnly={false}
          generatePreviewOnMount
          embedded={true}
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
      <aside className="col-span-1 border rounded bg-white dark:bg-slate-800 p-4 min-w-0" style={{ minWidth: 0 }}>
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
              onClick={() => handleMarkAccepted(selectedRequest)}
              className="w-full bg-amber-600 hover:bg-amber-700 text-white font-semibold py-2 px-4 rounded"
            >
              {isInvalidForAcceptance ? '🛠 Repair Required Before Acceptance' : '✅ Mark as Accepted'}
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
            <p><strong>Number:</strong> {selectedRequest.quotationNumber || selectedRequest.documentData?.quoteNumber}</p>
          )}
          {selectedRequest.invalidAcceptanceReason && (
            <p className="mt-2 text-amber-700 dark:text-amber-300">
              <strong>Repair reason:</strong> {selectedRequest.invalidAcceptanceReason}
            </p>
          )}
        </div>
      </aside>
      </div>

      <Modal
        isOpen={showRepairModal}
        onClose={() => setShowRepairModal(false)}
        title="Repair Quotation Before Acceptance"
        footer={(
          <>
            <Button variant="secondary" onClick={() => setShowRepairModal(false)} disabled={repairLoading}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleRepairAndAccept} disabled={repairLoading || !repairConfirmed || normalizedAmount(repairSubtotal) == null}>
              {repairLoading ? 'Processing...' : 'Confirm Repair & Accept'}
            </Button>
          </>
        )}
      >
        {selectedRequest && (
          <div className="space-y-4 text-sm">
            <div className="rounded border border-amber-200 bg-amber-50 p-3 text-amber-900">
              Acceptance is blocked until an explicit subtotal is confirmed by an admin. No computed values will be used.
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="rounded border p-3">
                <p className="text-xs uppercase text-slate-500">PDF subtotal</p>
                <p className="font-semibold">{money(selectedRequest.documentData?.subtotal)}</p>
              </div>
              <div className="rounded border p-3">
                <p className="text-xs uppercase text-slate-500">Last known subtotal</p>
                <p className="font-semibold">{money(selectedRequest.leadLatestRevisedPrice ?? selectedRequest.leadInitialPrice ?? selectedRequest.leadActualPrice)}</p>
              </div>
              <div className="rounded border p-3">
                <p className="text-xs uppercase text-slate-500">Lead actual price</p>
                <p className="font-semibold">{money(selectedRequest.leadActualPrice)}</p>
              </div>
            </div>

            <label className="block">
              <span className="block text-sm font-semibold mb-2">Admin confirmed subtotal</span>
              <input
                type="text"
                value={repairSubtotal}
                onChange={(e) => setRepairSubtotal(e.target.value)}
                placeholder="Enter exact subtotal to repair"
                className="w-full border rounded p-2"
              />
            </label>

            <label className="block">
              <span className="block text-sm font-semibold mb-2">Repair note</span>
              <textarea
                value={repairNote}
                onChange={(e) => setRepairNote(e.target.value)}
                placeholder="Optional note explaining the repair source"
                className="w-full border rounded p-2"
                rows={3}
              />
            </label>

            <label className="flex items-start gap-2 rounded border border-slate-200 bg-slate-50 p-3">
              <input
                type="checkbox"
                checked={repairConfirmed}
                onChange={(e) => setRepairConfirmed(e.target.checked)}
                className="mt-1"
              />
              <span>
                I confirm this subtotal is explicit, verified, and should be used as the only financial source for acceptance.
              </span>
            </label>
          </div>
        )}
      </Modal>
    </>
  );
}
