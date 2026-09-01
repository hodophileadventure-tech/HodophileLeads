import React, { useEffect, useMemo, useState } from 'react';
import { Button, Spinner } from './common';
import type { Lead, FollowUp } from '../types';
import { formatDate, formatKarachiDateTime } from '../utils/helpers';
import { followUpsAPI } from '../utils/api-service';
import { normalizeFollowUp } from '../utils/followup-utils';

interface TaskDashboardProps {
  leads: Lead[];
}

type TaskItem = {
  id: string;
  title: string;
  description: string;
  note?: string;
  priority: 'high' | 'medium' | 'low';
  status: 'overdue' | 'today' | 'upcoming';
  dueLabel: string;
  whatsappLink?: string;
};

export const TaskDashboard: React.FC<TaskDashboardProps> = ({ leads }) => {
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeFilter, setActiveFilter] = useState<'due' | 'pastdue' | 'active' | 'completed'>('due');
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [completionFollowUp, setCompletionFollowUp] = useState<FollowUp | null>(null);
  const [completionRemarks, setCompletionRemarks] = useState('');
  const [actionPlanFollowUp, setActionPlanFollowUp] = useState<FollowUp | null>(null);
  const [actionPlan, setActionPlan] = useState('');
  const actionPlanModalRef = React.useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const fetchTasks = async () => {
      try {
        setError('');
        const response = await followUpsAPI.list();
        const normalized = (response.data || []).map(normalizeFollowUp);
        console.log('[DEBUG TaskDashboard] Raw API response:', response.data);
        console.log('[DEBUG TaskDashboard] Normalized follow-ups:', normalized);
        console.log('[DEBUG TaskDashboard] Sample created_by_name:', normalized[0]?.createdByName);
        setFollowUps(normalized);
      } catch (err) {
        setError('Failed to load follow-up tasks.');
        console.error('[DEBUG TaskDashboard] Error fetching tasks:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchTasks();
  }, []);

  // Scroll modal into view when it opens
  useEffect(() => {
    if (actionPlanFollowUp && actionPlanModalRef.current) {
      actionPlanModalRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [actionPlanFollowUp]);

  const fallbackTasks = useMemo<TaskItem[]>(() => {
    const today = new Date();
    const safeLeads = Array.isArray(leads) ? leads : [];

    const safeFormat = (value: string | Date | number) => {
      const parsed = value instanceof Date ? value : new Date(value);
      return Number.isNaN(parsed.getTime()) ? 'Unknown date' : formatDate(parsed);
    };

    return safeLeads.slice(0, 20).map((lead, index) => {
      const status = String((lead as any).status || 'new');
      const temp = String((lead as any).temperature || 'cold');
      const name = String((lead as any).clientName || (lead as any).client_name || 'Unknown Client');
      const created = new Date((lead as any).createdAt || (lead as any).created_at || Date.now());
      const ageDays = Math.max(0, Math.floor((today.getTime() - created.getTime()) / (1000 * 60 * 60 * 24)));

      const taskStatus: TaskItem['status'] = ageDays > 7 ? 'overdue' : ageDays > 2 ? 'today' : 'upcoming';
      const priority: TaskItem['priority'] = temp === 'hot' || status === 'negotiation' ? 'high' : ageDays > 5 ? 'medium' : 'low';

      return {
        id: String((lead as any).id || index),
        title: `Follow up with ${name}`,
        description: `Lead is in ${status} stage (${temp} temperature).`,
        priority,
        status: taskStatus,
        dueLabel: taskStatus === 'overdue' ? `${ageDays} days in pipeline` : `Created ${safeFormat(created)}`
      };
    });
  }, [leads]);

  const tasks = useMemo<TaskItem[]>(() => {
    if (!followUps.length) return fallbackTasks;

    return followUps
      .filter((item) => item.status !== 'completed')
      .map((item) => ({
        id: item.id,
        title: item.title,
        description: item.description || 'Client follow-up task',
        note: item.description ? item.description : undefined,
        priority: item.priority,
        status: item.status === 'overdue' || item.status === 'today' ? item.status : 'upcoming',
        dueLabel: `Due ${formatKarachiDateTime(item.dueDate || '')}`,
        whatsappLink: item.whatsappLink
      }));
  }, [fallbackTasks, followUps]);

  const now = new Date();
  
  const dueFollowUps = useMemo(() => {
    return followUps.filter((item) => {
      if (item.status === 'completed' || item.status === 'canceled') return false;
      const due = new Date(item.dueDate || '');
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      return due < tomorrow && due >= now;
    });
  }, [followUps, now]);
  
  const pastDueFollowUps = useMemo(() => {
    return followUps.filter((item) => {
      if (item.status === 'completed' || item.status === 'canceled') return false;
      const due = new Date(item.dueDate || '');
      return due < now;
    });
  }, [followUps, now]);
  
  const activeFollowUps = useMemo(() => {
    return followUps.filter((item) => {
      if (item.status === 'completed' || item.status === 'canceled') return false;
      const due = new Date(item.dueDate || '');
      return due >= now;
    });
  }, [followUps, now]);
  
  const completedFollowUps = useMemo(() => {
    return followUps.filter((item) => item.status === 'completed');
  }, [followUps]);

  const visibleFollowUps = useMemo(() => {
    if (activeFilter === 'due') return dueFollowUps;
    if (activeFilter === 'pastdue') return pastDueFollowUps;
    if (activeFilter === 'active') return activeFollowUps;
    if (activeFilter === 'completed') return completedFollowUps;
    return followUps;
  }, [activeFilter, dueFollowUps, pastDueFollowUps, activeFollowUps, completedFollowUps, followUps]);

  const summary = useMemo(() => {
    return {
      overdue: tasks.filter((task) => task.status === 'overdue').length,
      today: tasks.filter((task) => task.status === 'today').length,
      upcoming: tasks.filter((task) => task.status === 'upcoming').length,
      highPriority: tasks.filter((task) => task.priority === 'high').length
    };
  }, [tasks]);

  const completeTask = (followUp: FollowUp) => {
    setCompletionFollowUp(followUp);
    setCompletionRemarks('');
    setShowCompletionModal(true);
  };

  const openActionPlan = (followUp: FollowUp) => {
    setActionPlanFollowUp(followUp);
    setActionPlan(followUp.actionPlan || '');
  };

  const saveActionPlan = async () => {
    if (!actionPlanFollowUp || !actionPlan.trim()) return;
    try {
      const response = await followUpsAPI.saveActionPlan(actionPlanFollowUp.id, actionPlan);
      const updated = normalizeFollowUp(response.data);
      setFollowUps((prev) => prev.map((item) => item.id === updated.id ? updated : item));
      setActionPlanFollowUp(null);
      setActionPlan('');
    } catch (err) {
      setError('Could not save action plan.');
    }
  };

  const confirmCompleteTask = async () => {
    if (!completionFollowUp) return;
    try {
      await followUpsAPI.complete(completionFollowUp.id, completionRemarks);
      setFollowUps((prev) => prev.map((item) => (item.id === completionFollowUp.id ? { ...item, status: 'completed' } : item)));
      window.dispatchEvent(new Event('followups-updated'));
      setShowCompletionModal(false);
      setCompletionFollowUp(null);
      setCompletionRemarks('');
    } catch (err) {
      setError('Could not complete task.');
    }
  };

  return (
    <div className="space-y-6">
      {loading && (
        <div className="flex justify-center py-6">
          <Spinner size="md" />
        </div>
      )}

      {error && (
        <div className="premium-analytics-card">
          <p className="text-red-600 font-medium text-sm">⚠️ {error}</p>
        </div>
      )}

      <div className="premium-kpi-grid">
        <div className="premium-kpi-card">
          <div className="premium-kpi-card-icon">⏰</div>
          <div className="premium-kpi-card-label">Overdue</div>
          <div className="premium-kpi-card-value text-red-600">{summary.overdue}</div>
        </div>
        <div className="premium-kpi-card">
          <div className="premium-kpi-card-icon">📍</div>
          <div className="premium-kpi-card-label">Due Today</div>
          <div className="premium-kpi-card-value text-green-600">{summary.today}</div>
        </div>
        <div className="premium-kpi-card">
          <div className="premium-kpi-card-icon">📅</div>
          <div className="premium-kpi-card-label">Upcoming</div>
          <div className="premium-kpi-card-value text-blue-600">{summary.upcoming}</div>
        </div>
        <div className="premium-kpi-card">
          <div className="premium-kpi-card-icon">🔥</div>
          <div className="premium-kpi-card-label">High Priority</div>
          <div className="premium-kpi-card-value text-orange-600">{summary.highPriority}</div>
        </div>
      </div>

      <div className="premium-filter-bar">
        {[
          { key: 'due', label: `📍 Due (${dueFollowUps.length})`, icon: '📍' },
          { key: 'pastdue', label: `⏰ Overdue (${pastDueFollowUps.length})`, icon: '⏰' },
          { key: 'active', label: `📋 Active (${activeFollowUps.length})`, icon: '📋' },
          { key: 'completed', label: `✅ Completed (${completedFollowUps.length})`, icon: '✅' }
        ].map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setActiveFilter(item.key as typeof activeFilter)}
            className={`premium-filter-btn ${activeFilter === item.key ? 'active' : ''}`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div>
        <h2 className="text-xl font-bold mb-4">Task Queue</h2>

        {visibleFollowUps.length === 0 ? (
          <div className="premium-empty-state">
            <div className="premium-empty-state-icon">📭</div>
            <h3>No Tasks</h3>
            <p>All tasks are complete or no follow-ups scheduled for this view</p>
          </div>
        ) : (
          <div className="space-y-3">
            {visibleFollowUps.map((item) => {
              const task: TaskItem = {
                id: item.id,
                title: item.title,
                description: item.description || 'Client follow-up task',
                priority: item.priority,
                status: item.status === 'overdue' || item.status === 'today' ? item.status : 'upcoming',
                dueLabel: `Due ${formatKarachiDateTime(item.dueDate || '')}`,
                whatsappLink: item.whatsappLink
              };

              return (
              <div key={task.id} className="premium-task-card">
                <div className="premium-task-card-header">
                  <div className="flex-1">
                    <h3 className="premium-task-card-title">{task.title}</h3>
                    <p className="text-sm text-slate-600 mt-1">
                      {item.clientName
                        ? (
                          <>📞 <span className="font-medium">{item.clientName}</span>{item.phone && <span className="text-slate-500"> · {item.phone}</span>}</>
                        )
                        : item.phone
                          ? <>📞 <span className="font-medium">{item.phone}</span></>
                          : <>📌 <span className="font-medium">{item.leadId}</span></>}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <span className={`premium-task-card-priority ${task.priority}`}>
                      {task.priority.toUpperCase()}
                    </span>
                  </div>
                </div>

                <p className="premium-task-card-description">{task.description}</p>

                {item.createdByName && (
                  <p className="text-sm px-2 py-1 inline-block bg-blue-100 text-blue-800 rounded font-medium mb-2">
                    👤 Follow up of {item.createdByName}
                  </p>
                )}

                {task.note && (
                  <p className="text-sm text-slate-600 mt-2 whitespace-pre-wrap border-l-2 border-amber-400 pl-3 py-2 bg-amber-50 rounded">
                    📝 {task.note}
                  </p>
                )}

                {item.actionPlan && (
                  <p className="text-sm text-green-700 mt-2 font-medium">✅ Action Plan: Filled</p>
                )}

                {item.status === 'canceled' && (item.canceledReason || item.canceledBy) && (
                  <p className="text-sm text-rose-700 mt-2 font-medium">
                    ✖️ Canceled{item.canceledBy ? ` by ${String(item.canceledBy)}` : ''}{item.canceledReason ? `: ${item.canceledReason}` : ''}
                  </p>
                )}

                <div className="premium-task-card-footer">
                  <div className="premium-task-card-due">
                    📅 {task.dueLabel}
                  </div>
                  <div className="premium-task-card-actions">
                    {item.status !== 'canceled' && (
                      <button
                        onClick={() => openActionPlan(item)}
                        className="premium-task-card-action-btn"
                      >
                        Plan
                      </button>
                    )}
                    {task.whatsappLink && item.status !== 'canceled' && (
                      <button
                        onClick={() => window.open(task.whatsappLink, '_blank', 'noopener,noreferrer')}
                        className="premium-task-card-action-btn"
                      >
                        WhatsApp
                      </button>
                    )}
                    {item.status !== 'canceled' && (
                      <button
                        onClick={() => completeTask(item)}
                        disabled={!item.actionPlan?.trim()}
                        className="premium-task-card-action-btn primary"
                        title={!item.actionPlan?.trim() ? 'Add an Action Plan first' : 'Mark as done'}
                      >
                        Done
                      </button>
                    )}
                  </div>
                </div>
              </div>
              );
            })}
          </div>
        )}
      </div>

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
                onClick={confirmCompleteTask}
              >
                Mark Complete
              </Button>
            </div>
          </div>
        </div>
      )}

      {actionPlanFollowUp && (
        <div ref={actionPlanModalRef} className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-hidden">
          <div className="w-full max-w-lg max-h-[90vh] rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-5 shadow-2xl flex flex-col overflow-auto">
            <h3 className="text-xl font-bold mb-1">Action Plan</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Write the detailed plan for this follow-up.</p>
            <textarea
              className="w-full border border-slate-300 dark:border-slate-600 rounded-lg p-3 dark:bg-slate-800 dark:text-white"
              rows={7}
              value={actionPlan}
              onChange={(event) => setActionPlan(event.target.value)}
              placeholder="Describe the steps you will take..."
            />
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => { setActionPlanFollowUp(null); setActionPlan(''); }}>Cancel</Button>
              <Button variant="primary" onClick={saveActionPlan} disabled={!actionPlan.trim()}>Save Action Plan</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
