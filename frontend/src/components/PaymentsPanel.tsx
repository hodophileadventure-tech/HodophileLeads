import React from 'react';
import { paymentsAPI, leadsAPI } from '../utils/api-service';
import { Button, Modal } from './common';
import type { Payment, Lead } from '../types';

interface PaymentsPanelProps {
  leadId: string;
  lead?: Lead;
}

export const PaymentsPanel: React.FC<PaymentsPanelProps> = ({ leadId, lead }) => {
  const [payments, setPayments] = React.useState<Payment[]>([]);
  const [displayLead, setDisplayLead] = React.useState<Lead | undefined>(lead);
  const [loading, setLoading] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState({ amount: 0, method: 'cash', dueDate: '', notes: '' });
  const [formError, setFormError] = React.useState('');
  const [confirmingPayment, setConfirmingPayment] = React.useState<Payment | null>(null);
  const [proofFile, setProofFile] = React.useState<File | null>(null);
  const [confirmingLoading, setConfirmingLoading] = React.useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await paymentsAPI.list(leadId);
      setPayments(res.data || []);
    } catch (e) {
      console.error('Failed to load payments:', e);
      setPayments([]);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    setDisplayLead(lead);
  }, [lead]);

  React.useEffect(() => { load(); }, [leadId]);

  React.useEffect(() => {
    const handleLeadPricingUpdated = async (event: Event) => {
      const customEvent = event as CustomEvent<{ leadId?: string; lead?: Lead | null }>;
      const updatedLeadId = customEvent.detail?.leadId;
      if (updatedLeadId && String(updatedLeadId) !== String(leadId)) {
        return;
      }

      try {
        if (customEvent.detail?.lead) {
          setDisplayLead(customEvent.detail.lead);
          return;
        }

        const response = await paymentsAPI.list(leadId);
        setPayments(response.data || []);

        const { data } = await leadsAPI.getById(leadId);
        setDisplayLead(data);
      } catch (error) {
        console.error('Failed to refresh payment panel after pricing update:', error);
      }
    };

    window.addEventListener('lead-payment-pricing-updated', handleLeadPricingUpdated as EventListener);
    return () => window.removeEventListener('lead-payment-pricing-updated', handleLeadPricingUpdated as EventListener);
  }, [leadId]);

  const totalDeposits = payments.reduce((sum, payment) => sum + (payment.amount || 0), 0);
  const initialPrice = (displayLead as any)?.initialPrice ?? (displayLead as any)?.initial_price ?? null;
  const latestRevisedPrice = (displayLead as any)?.latestRevisedPrice ?? (displayLead as any)?.latest_revised_price ?? null;
  const actualPrice = (displayLead as any)?.actualPrice ?? (displayLead as any)?.actual_price ?? null;
  const remainingBalance = actualPrice != null ? Math.max((Number(actualPrice) || 0) - totalDeposits, 0) : null;
  const paymentStatus = actualPrice == null
    ? 'Unpaid'
    : totalDeposits <= 0
      ? 'Unpaid'
      : remainingBalance !== null && remainingBalance > 0
        ? 'Partially Paid'
        : 'Paid';

  return (
    <div className="card mt-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className="font-semibold">Payments / Deposits</h3>
        <Button size="sm" onClick={() => { setFormError(''); setOpen(true); }}>Add Payment</Button>
      </div>

      <div className="mb-4 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
          <div>
            <p className="text-slate-600 dark:text-slate-400">Initial Price</p>
            <p className="font-semibold">{initialPrice != null ? `PKR ${Number(initialPrice).toLocaleString()}` : '—'}</p>
          </div>
          <div>
            <p className="text-slate-600 dark:text-slate-400">Latest Revised Price</p>
            <p className="font-semibold">{latestRevisedPrice != null ? `PKR ${Number(latestRevisedPrice).toLocaleString()}` : '—'}</p>
          </div>
          <div>
            <p className="text-slate-600 dark:text-slate-400">Actual Price</p>
            <p className="font-semibold">{actualPrice != null ? `PKR ${Number(actualPrice).toLocaleString()}` : '—'}</p>
          </div>
          <div>
            <p className="text-slate-600 dark:text-slate-400">Total Deposits</p>
            <p className="font-semibold">PKR {totalDeposits.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-slate-600 dark:text-slate-400">Remaining Balance</p>
            <p className={`font-semibold ${remainingBalance == null ? 'text-slate-500' : remainingBalance <= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {remainingBalance == null ? '—' : `PKR ${remainingBalance.toLocaleString()}`}
            </p>
          </div>
        </div>
        <div className="mt-3 text-sm">
          <span className="text-slate-600 dark:text-slate-400">Payment Status: </span>
          <span className="font-semibold">{paymentStatus}</span>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Loading payments...</p>
      ) : payments.length === 0 ? (
        <p className="text-sm text-slate-500">No payment records yet.</p>
      ) : (
        <div className="space-y-3">
          {payments.map((payment) => (
            <div key={payment.id} className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 flex flex-wrap justify-between gap-3">
              <div>
                <p className="font-medium">PKR {payment.amount}</p>
                <p className="text-xs text-slate-500">{payment.method} · Due {payment.dueDate || (payment as any).due_date}</p>
                <p className="text-xs text-slate-500">Status: {payment.status}</p>
                {(payment.proofUrl || (payment as any).proof_url) && (
                  <a href={payment.proofUrl || (payment as any).proof_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 dark:text-blue-400 hover:underline mt-1 inline-block">📎 View Proof</a>
                )}
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => setConfirmingPayment(payment)}>Confirm</Button>
                <Button size="sm" variant="danger" onClick={async () => { if (!confirm('Delete payment?')) return; await paymentsAPI.delete(payment.id); await load(); window.dispatchEvent(new Event('dashboard-refresh')); }}>Delete</Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        isOpen={open}
        onClose={() => setOpen(false)}
        title="Add Payment / Deposit"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={async () => {
              try {
                setFormError('');
                if (actualPrice == null || actualPrice <= 0) {
                  setFormError('Accepted quotation is required before recording deposits.');
                  return;
                }

                const proposedAmount = Number(form.amount);
                if (proposedAmount <= 0) {
                  setFormError('Deposit amount must be greater than zero.');
                  return;
                }

                const nextTotal = totalDeposits + proposedAmount;
                if (nextTotal > Number(actualPrice)) {
                  setFormError(`Deposit cannot exceed the accepted quotation actual price of PKR ${Number(actualPrice).toLocaleString()}.`);
                  return;
                }

                console.log('Creating payment:', { leadId, amount: form.amount, method: form.method });
                await paymentsAPI.create({
                  leadId,
                  amount: proposedAmount,
                  method: form.method as any,
                  dueDate: new Date(form.dueDate).toISOString(),
                  notes: form.notes
                });
                console.log('Payment created successfully');
                setOpen(false);
                setForm({ amount: 0, method: 'cash', dueDate: '', notes: '' });
                setFormError('');
                await load();
                window.dispatchEvent(new Event('dashboard-refresh'));
              } catch (error) {
                console.error('Failed to create payment:', error);
                alert('Failed to add payment: ' + (error instanceof Error ? error.message : String(error)));
              }
            }}>Save</Button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="block text-sm mb-1">Amount</label>
            <input type="number" className="input-field" value={form.amount} onChange={(e) => setForm((s) => ({ ...s, amount: Number(e.target.value) }))} />
          </div>
          <div>
            <label className="block text-sm mb-1">Method</label>
            <select className="input-field" value={form.method} onChange={(e) => setForm((s) => ({ ...s, method: e.target.value }))}>
              <option value="cash">Cash</option>
              <option value="card">Card</option>
              <option value="bank_transfer">Bank Transfer</option>
            </select>
          </div>
          <div>
            <label className="block text-sm mb-1">Due Date</label>
            <input type="datetime-local" className="input-field" value={form.dueDate} onChange={(e) => setForm((s) => ({ ...s, dueDate: e.target.value }))} />
          </div>
          <div>
            <label className="block text-sm mb-1">Notes</label>
            <textarea className="input-field" value={form.notes} onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value }))} />
          </div>
          {formError && <p className="text-sm text-red-600">{formError}</p>}
        </div>
      </Modal>

      <Modal
        isOpen={!!confirmingPayment}
        onClose={() => { setConfirmingPayment(null); setProofFile(null); }}
        title="Confirm Payment & Upload Proof"
        footer={
          <>
            <Button variant="secondary" onClick={() => { setConfirmingPayment(null); setProofFile(null); }} disabled={confirmingLoading}>Cancel</Button>
            <Button variant="primary" onClick={async () => {
              if (!confirmingPayment) return;
              try {
                setConfirmingLoading(true);
                const formData = new FormData();
                if (proofFile) {
                  formData.append('proof', proofFile);
                }
                console.log('Confirming payment:', confirmingPayment.id, 'with proof file:', proofFile?.name);
                
                const response = await paymentsAPI.confirm(confirmingPayment.id, formData);
                console.log('Payment confirmed successfully:', response);
                
                setConfirmingPayment(null);
                setProofFile(null);
                await load();
                window.dispatchEvent(new Event('dashboard-refresh'));
                alert('Payment confirmed successfully!');
              } catch (error) {
                console.error('Failed to confirm payment:', error);
                alert('Failed to confirm payment: ' + (error instanceof Error ? error.message : String(error)));
              } finally {
                setConfirmingLoading(false);
              }
            }} disabled={confirmingLoading || !proofFile}>Confirm Payment</Button>
          </>
        }
      >
        {confirmingPayment && (
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-slate-100 dark:bg-slate-800">
              <p className="text-sm text-slate-600 dark:text-slate-400">Amount to Confirm:</p>
              <p className="text-xl font-bold">PKR {confirmingPayment.amount.toLocaleString()}</p>
              <p className="text-xs text-slate-500 mt-1">Method: {confirmingPayment.method}</p>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">Upload Proof of Payment</label>
              <p className="text-xs text-slate-500 mb-2">Accepted: JPG, PNG, GIF, PDF (Max 5MB)</p>
              <div className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg p-4 text-center">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/gif,application/pdf"
                  onChange={(e) => setProofFile(e.target.files?.[0] || null)}
                  className="hidden"
                  id="proof-input"
                />
                <label htmlFor="proof-input" className="cursor-pointer">
                  {proofFile ? (
                    <>
                      <p className="font-medium text-green-600">✓ {proofFile.name}</p>
                      <p className="text-xs text-slate-500 mt-1">{(proofFile.size / 1024).toFixed(2)} KB</p>
                    </>
                  ) : (
                    <>
                      <p className="text-slate-600 dark:text-slate-400">Click to upload screenshot/receipt</p>
                      <p className="text-xs text-slate-500 mt-1">or drag and drop</p>
                    </>
                  )}
                </label>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default PaymentsPanel;
