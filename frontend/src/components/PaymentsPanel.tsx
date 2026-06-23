import React from 'react';
import { paymentsAPI } from '../utils/api-service';
import { Button, Modal } from './common';
import type { Payment, Lead } from '../types';

interface PaymentsPanelProps {
  leadId: string;
  lead?: Lead;
}

export const PaymentsPanel: React.FC<PaymentsPanelProps> = ({ leadId, lead }) => {
  const [payments, setPayments] = React.useState<Payment[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState({ amount: 0, method: 'cash', dueDate: '', notes: '' });
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

  React.useEffect(() => { load(); }, [leadId]);

  // Calculate totals
  const totalPayments = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
  const tripBudget = (lead as any)?.tripBudget || (lead as any)?.trip_budget;
  const remainingBudget = tripBudget ? tripBudget - totalPayments : null;

  return (
    <div className="card mt-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className="font-semibold">Payments / Deposits</h3>
        <Button size="sm" onClick={() => setOpen(true)}>Add Payment</Button>
      </div>

      {tripBudget && (
        <div className="mb-4 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-slate-600 dark:text-slate-400">Trip Budget</p>
              <p className="font-semibold">PKR {tripBudget.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-slate-600 dark:text-slate-400">Total Payments</p>
              <p className="font-semibold">PKR {totalPayments.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-slate-600 dark:text-slate-400">Remaining</p>
              <p className={`font-semibold ${remainingBudget! >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                PKR {remainingBudget!.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      )}

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
                console.log('Creating payment:', { leadId, amount: form.amount, method: form.method });
                await paymentsAPI.create({
                  leadId,
                  amount: Number(form.amount),
                  method: form.method as any,
                  dueDate: new Date(form.dueDate).toISOString(),
                  notes: form.notes
                });
                console.log('Payment created successfully');
                setOpen(false);
                setForm({ amount: 0, method: 'cash', dueDate: '', notes: '' });
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
