import React, { useEffect, useMemo, useState } from 'react';
import { Card, Badge, Button, Spinner } from './common';
import type { Lead, FollowUp } from '../types';
import { formatDate } from '../utils/helpers';
import { followUpsAPI } from '../utils/api-service';

interface TaskDashboardProps {
  leads: Lead[];
}

type TaskItem = {
  id: string;
  title: string;
  description: string;
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
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'canceled'>('all');

  useEffect(() => {
    const fetchTasks = async () => {
      try {
        setError('');
        const response = await followUpsAPI.list();
        setFollowUps(response.data || []);
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
        priority: item.priority,
        status: item.status === 'overdue' || item.status === 'today' ? item.status : 'upcoming',
        dueLabel: `Due ${formatDate(item.dueDate || '')}`,
        whatsappLink: item.whatsappLink
      }));
  }, [fallbackTasks, followUps]);

  const activeFollowUps = useMemo(() => followUps.filter((item) => item.status !== 'completed' && item.status !== 'canceled'), [followUps]);
  const canceledFollowUps = useMemo(() => followUps.filter((item) => item.status === 'canceled'), [followUps]);

  const visibleFollowUps = useMemo(() => {
    if (activeFilter === 'active') return activeFollowUps;
    if (activeFilter === 'canceled') return canceledFollowUps;
    return followUps;
  }, [activeFilter, activeFollowUps, canceledFollowUps, followUps]);

  const summary = useMemo(() => {
    return {
      overdue: tasks.filter((task) => task.status === 'overdue').length,
      today: tasks.filter((task) => task.status === 'today').length,
      upcoming: tasks.filter((task) => task.status === 'upcoming').length,
      highPriority: tasks.filter((task) => task.priority === 'high').length
    };
  }, [tasks]);

  const completeTask = async (id: string) => {
    try {
      await followUpsAPI.complete(id);
      setFollowUps((prev) => prev.map((item) => (item.id === id ? { ...item, status: 'completed' } : item)));
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
          { key: 'all', label: `All (${followUps.length})`, color: 'bg-slate-200 dark:bg-slate-700' },
          { key: 'active', label: `Active (${activeFollowUps.length})`, color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200' },
          { key: 'canceled', label: `Canceled (${canceledFollowUps.length})`, color: 'bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200' }
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
                dueLabel: `Due ${formatDate(item.dueDate || '')}`,
                whatsappLink: item.whatsappLink
              };

              return (
              <div key={task.id} className="p-4 rounded-lg border border-slate-200 dark:border-slate-700">
                <div className="flex flex-wrap gap-2 justify-between items-start">
                  <div>
                    <h3 className="font-semibold">{task.title}</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{task.description}</p>
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
                    <Button variant="primary" size="sm" onClick={() => completeTask(task.id)}>
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
    </div>
  );
};
