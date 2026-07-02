import React, { useEffect, useMemo, useState } from 'react';
import { Card, Badge, Button, Spinner } from './common';
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

const getPriorityColor = (priority: TaskItem['priority']) => {
  if (priority === 'high') return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
  if (priority === 'medium') return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
  return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
};

const getStatusColor = (status: TaskItem['status']) => {
  if (status === 'overdue') return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
  if (status === 'today') return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
  return 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-200';
};

export const TaskDashboard: React.FC<TaskDashboardProps> = ({ leads }) => {
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeFilter, setActiveFilter] = useState<'due' | 'pastdue' | 'active' | 'completed'>('due');
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [completionFollowUp, setCompletionFollowUp] = useState<FollowUp | null>(null);
  const [completionRemarks, setCompletionRemarks] = useState('');

  useEffect(() => {
    const fetchTasks = async () => {
      try {
        setError('');
        const response = await followUpsAPI.list();
        setFollowUps((response.data || []).map(normalizeFollowUp));
      } catch (err) {
        setError('Failed to load follow-up tasks.');
      } finally {
        setLoading(false);
      }
    };

    fetchTasks();
  }, []);

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

  const confirmCompleteTask = async () => {
    if (!completionFollowUp) return;
    try {
      await followUpsAPI.complete(completionFollowUp.id, completionRemarks);
      setFollowUps((prev) => prev.map((item) => (item.id === completionFollowUp.id ? { ...item, status: 'completed' } : item)));
      setShowCompletionModal(false);
      setCompletionFollowUp(null);
      setCompletionRemarks('');
    } catch (err) {
      setError('Could not complete task.');
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Tasks</h1>

      {loading && (
        <div className="flex justify-center py-6">
          <Spinner size="md" />
        </div>
      )}

      {error && (
        <Card>
          <p className="text-red-600 dark:text-red-300 text-sm">{error}</p>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <p className="text-sm text-slate-600 dark:text-slate-400">Overdue</p>
          <p className="text-3xl font-bold text-red-500">{summary.overdue}</p>
        </Card>
        <Card>
          <p className="text-sm text-slate-600 dark:text-slate-400">Due Today</p>
          <p className="text-3xl font-bold text-green-500">{summary.today}</p>
        </Card>
        <Card>
          <p className="text-sm text-slate-600 dark:text-slate-400">Upcoming</p>
          <p className="text-3xl font-bold text-blue-500">{summary.upcoming}</p>
        </Card>
        <Card>
          <p className="text-sm text-slate-600 dark:text-slate-400">High Priority</p>
          <p className="text-3xl font-bold text-yellow-500">{summary.highPriority}</p>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          { key: 'due', label: `Due (${dueFollowUps.length})`, color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
          { key: 'pastdue', label: `Past Due (${pastDueFollowUps.length})`, color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' },
          { key: 'active', label: `Active (${activeFollowUps.length})`, color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
          { key: 'completed', label: `Completed (${completedFollowUps.length})`, color: 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-200' }
        ].map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setActiveFilter(item.key as typeof activeFilter)}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${activeFilter === item.key ? item.color : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'}`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <Card>
        <h2 className="text-xl font-bold mb-4">Task Queue</h2>

        {visibleFollowUps.length === 0 ? (
          <p className="text-slate-600 dark:text-slate-400">No tasks yet. Add some leads to generate follow-up tasks.</p>
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
              <div key={task.id} className="p-4 rounded-lg border border-slate-200 dark:border-slate-700">
                <div className="flex flex-wrap gap-2 justify-between items-start">
                  <div>
                    <h3 className="font-semibold">{task.title}</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                      {item.clientName
                        ? (
                          <>Client: <span className="font-medium">{item.clientName}</span>{item.phone && <span className="text-slate-500"> · {item.phone}</span>}</>
                        )
                        : item.phone
                          ? <>Client: <span className="font-medium">{item.phone}</span></>
                          : <>Client ID: <span className="font-medium">{item.leadId}</span></>}
                    </p>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{task.description}</p>
                    {task.note && (
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 whitespace-pre-wrap">
                        Note: {task.note}
                      </p>
                    )}
                    <p className="text-xs text-slate-500 mt-2">{task.dueLabel}</p>
                    {item.status === 'canceled' && (item.canceledReason || item.canceledBy) && (
                      <p className="text-xs text-rose-700 dark:text-rose-200 mt-2">
                        Canceled{item.canceledBy ? ` by ${String(item.canceledBy)}` : ''}{item.canceledReason ? `: ${item.canceledReason}` : ''}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Badge color={getStatusColor(task.status)}>{task.status}</Badge>
                    <Badge color={getPriorityColor(task.priority)}>{task.priority}</Badge>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {task.whatsappLink && item.status !== 'canceled' && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => window.open(task.whatsappLink, '_blank', 'noopener,noreferrer')}
                    >
                      Open WhatsApp
                    </Button>
                  )}
                  {item.status !== 'canceled' && (
                    <Button variant="primary" size="sm" onClick={() => completeTask(item)}>
                      Mark Done
                    </Button>
                  )}
                </div>
              </div>
              );
            })}
          </div>
        )}
      </Card>

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
    </div>
  );
};
