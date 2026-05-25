import React from 'react';
import { paymentsAPI } from '../utils/api-service';
import { Button, Modal } from './common';
import type { Payment } from '../types';

interface PaymentsPanelProps {
  leadId: string;
}

export const PaymentsPanel: React.FC<PaymentsPanelProps> = ({ leadId }) => {
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
      setPayments([]);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => { load(); }, [leadId]);

  return (
    <div className="card mt-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className="font-semibold">Payments / Deposits</h3>
        <Button size="sm" onClick={() => setOpen(true)}>Add Payment</Button>
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
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={async () => { await paymentsAPI.confirm(payment.id); await load(); }}>Confirm</Button>
                <Button size="sm" variant="danger" onClick={async () => { if (!confirm('Delete payment?')) return; await paymentsAPI.delete(payment.id); await load(); }}>Delete</Button>
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
              await paymentsAPI.create({
                leadId,
                amount: Number(form.amount),
                method: form.method as any,
                dueDate: new Date(form.dueDate).toISOString(),
                notes: form.notes
              });
              setOpen(false);
              setForm({ amount: 0, method: 'cash', dueDate: '', notes: '' });
              await load();
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
