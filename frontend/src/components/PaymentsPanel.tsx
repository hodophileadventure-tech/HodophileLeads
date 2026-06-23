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
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={async () => { await paymentsAPI.confirm(payment.id); await load(); window.dispatchEvent(new Event('dashboard-refresh')); }}>Confirm</Button>
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
    </div>
  );
};

export default PaymentsPanel;
