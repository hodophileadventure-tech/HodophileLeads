import React from 'react';
import { followUpsAPI } from '../utils/api-service';
import { normalizeFollowUp } from '../utils/followup-utils';
import { formatKarachiDateTime, getKarachiLocalDateTimeString, parseKarachiDateTimeToISOString } from '../utils/helpers';
import { Button } from './common';

export const RemindersPanel: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [items, setItems] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [filter, setFilter] = React.useState<'all' | 'today' | 'upcoming' | 'overdue'>('all');
  const [editing, setEditing] = React.useState<any | null>(null);
  const [form, setForm] = React.useState({ title: '', dueDate: '', priority: 'medium', status: 'upcoming', description: '' });
  const [showCompletionModal, setShowCompletionModal] = React.useState(false);
  const [completionFollowUp, setCompletionFollowUp] = React.useState<any | null>(null);
  const [completionRemarks, setCompletionRemarks] = React.useState('');

  const load = async () => {
    setLoading(true);
    try {
      const res = await followUpsAPI.list();
      setItems((res.data || []).map(normalizeFollowUp));
    } catch (e) {
      // ignore
    } finally { setLoading(false); }
  };

  React.useEffect(() => { load(); }, []);

  const filtered = items.filter((i) => {
    if (filter === 'all') return true;
    return i.status === filter;
  });

  const openEdit = (item: any) => {
    setEditing(item);
    setForm({
      title: item.title || item.task_type || '',
      dueDate: item.due_date ? getKarachiLocalDateTimeString(new Date(item.due_date)) : '',
      priority: item.priority || 'medium',
      status: item.status || 'upcoming',
      description: item.notes || item.description || ''
    });
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
      <div className="bg-white dark:bg-slate-800 rounded-lg w-full max-w-3xl p-4">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-semibold">Reminders</h3>
          <div className="flex items-center gap-2">
            <select value={filter} onChange={(e) => setFilter(e.target.value as any)} className="p-1 rounded bg-slate-50 dark:bg-slate-700">
              <option value="all">All</option>
              <option value="today">Today</option>
              <option value="upcoming">Upcoming</option>
              <option value="overdue">Overdue</option>
            </select>
            <button onClick={onClose} className="px-3 py-1 rounded bg-slate-200">Close</button>
          </div>
        </div>
        <div className="max-h-96 overflow-auto">
          {loading && <p className="text-sm">Loading...</p>}
          {!loading && filtered.length === 0 && <p className="text-sm text-slate-500">No reminders</p>}
          {filtered.map((r) => (
            <div key={r.id} className="border-b border-slate-100 dark:border-slate-700 px-2 py-3 flex justify-between items-start">
              <div>
                <p className="font-medium">{r.title || r.task_type}</p>
                <p className="text-xs text-slate-500">Due: {formatKarachiDateTime(r.due_date)}</p>
                {(r.description || r.notes) && <p className="text-xs text-slate-600 mt-1 whitespace-pre-wrap">Note: {r.description || r.notes}</p>}
                <p className="text-xs text-slate-400">Status: {r.status}</p>
              </div>
              <div className="flex flex-col gap-2">
                <button className="text-xs px-2 py-1 rounded bg-slate-200" onClick={() => openEdit(r)}>Edit</button>
                <button className="text-xs px-2 py-1 rounded bg-primary-500 text-white" onClick={() => {
                  setCompletionFollowUp(r);
                  setCompletionRemarks('');
                  setShowCompletionModal(true);
                }}>Mark Done</button>
                <button className="text-xs px-2 py-1 rounded bg-slate-200" onClick={async () => {
                  if (!confirm('Delete reminder?')) return;
                  try { await followUpsAPI.delete(r.id); await load(); } catch (e) {}
                }}>Delete</button>
              </div>
            </div>
          ))}
        </div>

        {editing && (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
            <div className="bg-white dark:bg-slate-800 rounded-lg p-4 w-full max-w-md">
              <h4 className="font-semibold mb-2">Edit Reminder</h4>
              <div className="space-y-2">
                <input className="w-full p-2 rounded bg-slate-50 dark:bg-slate-700" value={form.title} onChange={(e) => setForm((s) => ({ ...s, title: e.target.value }))} />
                <input type="datetime-local" className="w-full p-2 rounded bg-slate-50 dark:bg-slate-700" value={form.dueDate} onChange={(e) => setForm((s) => ({ ...s, dueDate: e.target.value }))} />
                <select className="w-full p-2 rounded bg-slate-50 dark:bg-slate-700" value={form.priority} onChange={(e) => setForm((s) => ({ ...s, priority: e.target.value }))}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
                <textarea className="w-full p-2 rounded bg-slate-50 dark:bg-slate-700" value={form.description} onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))} />
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <button className="px-3 py-1 rounded bg-slate-200" onClick={() => setEditing(null)}>Cancel</button>
                <button className="px-3 py-1 rounded bg-primary-500 text-white" onClick={async () => {
                  try {
                    const updatePayload: any = {
                      title: form.title,
                      dueDate: parseKarachiDateTimeToISOString(form.dueDate),
                      priority: form.priority as any
                    };
                    if (form.description.trim()) {
                      updatePayload.description = form.description.trim();
                    }
                    await followUpsAPI.update(editing.id, {
                      ...updatePayload
                    });
                    setEditing(null);
                    await load();
                  } catch (e) {
                    alert('Failed to save reminder');
                  }
                }}>Save</button>
              </div>
            </div>
          </div>
        )}

        {showCompletionModal && completionFollowUp && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-5 shadow-2xl">
              <h3 className="text-xl font-bold mb-1">Mark Follow-up Complete</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Add remarks about this follow-up (optional). These will be saved to the lead.</p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Remarks / Notes</label>
                  <textarea
                    className="w-full border border-slate-300 dark:border-slate-600 rounded-lg p-3 dark:bg-slate-800 dark:text-white"
                    rows={5}
                    placeholder="e.g., Client confirmed dates, requires hotel confirmation, waiting for payment..."
                    value={completionRemarks}
                    onChange={(e) => setCompletionRemarks(e.target.value)}
                  />
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-2">
                <Button 
                  variant="secondary" 
                  onClick={() => {
                    setShowCompletionModal(false);
                    setCompletionFollowUp(null);
                    setCompletionRemarks('');
                  }}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={async () => {
                    try {
                      await followUpsAPI.complete(completionFollowUp.id, completionRemarks);
                      await load();
                      setShowCompletionModal(false);
                      setCompletionFollowUp(null);
                      setCompletionRemarks('');
                    } catch (e) {
                      alert('Failed to complete follow-up');
                    }
                  }}
                >
                  Mark Complete
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RemindersPanel;
