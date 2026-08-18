import React, { useEffect, useMemo, useState } from 'react';
import { Button, Spinner } from './common';
import { useAuth } from '../context/AuthContext';
import { tasksAPI, adminAPI } from '../utils/api-service';

interface TaskRecord {
  id: string;
  title: string;
  description?: string;
  status: 'assigned' | 'in_progress' | 'submitted' | 'revision_requested' | 'approved' | 'cancelled';
  priority: 'low' | 'medium' | 'high';
  deadline?: string;
  assigned_to?: string;
  created_by?: string;
  created_by_name?: string;
  assigned_to_name?: string;
  created_at?: string;
  started_at?: string;
  submitted_at?: string;
  approved_at?: string;
}

const roleLabel = (role?: string) => {
  if (!role) return 'Team member';
  return role
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

const formatDate = (value?: string) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
};

const statusColor: Record<TaskRecord['status'], string> = {
  assigned: 'bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200',
  in_progress: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  submitted: 'bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200',
  revision_requested: 'bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200',
  approved: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
  cancelled: 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
};

const priorityColor: Record<TaskRecord['priority'], string> = {
  low: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  high: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};

export const CreativeWorkPanel: React.FC = () => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [users, setUsers] = useState<Array<{ id: string; name: string; role_slug?: string; role_name?: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [deadline, setDeadline] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');

  const isAdmin = user?.role === 'admin';

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const response = await tasksAPI.list();
      setTasks(response.data?.data || []);
    } catch (err) {
      console.error('Failed to load tasks', err);
      setError('Could not load tasks.');
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    if (!isAdmin) return;
    try {
      const response = await adminAPI.getUsers();
      setUsers(response.data?.users || []);
    } catch (err) {
      console.error('Failed to load users', err);
    }
  };

  useEffect(() => {
    void fetchTasks();
    void fetchUsers();
  }, [user?.id]);

  const filteredTasks = useMemo(() => {
    if (!user?.id) return [];
    if (isAdmin) return tasks;
    return tasks.filter((task) => String(task.assigned_to || '') === String(user.id) || String(task.created_by || '') === String(user.id));
  }, [tasks, user?.id, isAdmin]);

  const createTask = async () => {
    if (!isAdmin) return;
    if (!title.trim() || !assignedTo || !deadline) {
      setError('Please fill in task title, assignee, and deadline.');
      return;
    }

    try {
      setError('');
      await tasksAPI.create({
        title: title.trim(),
        description: description.trim(),
        assigned_to: assignedTo,
        deadline,
        priority,
      });
      setTitle('');
      setDescription('');
      setAssignedTo('');
      setDeadline('');
      setPriority('medium');
      await fetchTasks();
    } catch (err) {
      console.error('Failed to create task', err);
      setError('Failed to assign task.');
    }
  };

  const updateTaskAction = async (taskId: string, action: 'start' | 'submit' | 'approve' | 'request-revision') => {
    try {
      const methods: Record<typeof action, (id: string, payload?: any) => Promise<any>> = {
        start: tasksAPI.start,
        submit: tasksAPI.submit,
        approve: tasksAPI.approve,
        'request-revision': tasksAPI.requestRevision,
      };

      await methods[action](taskId, action === 'request-revision' ? { review_notes: 'Please revise and resubmit this task.' } : undefined);
      await fetchTasks();
    } catch (err) {
      console.error(`Failed to ${action} task`, err);
      setError(`Could not ${action.replace('-', ' ')} the task.`);
    }
  };

  return (
    <div className="space-y-6">
      <section className="card">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
              {isAdmin ? 'Task Assignment Center' : `${roleLabel(user?.role)} Workspace`}
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              {isAdmin
                ? 'Assign work to creators and editors, then review submissions before approval.'
                : 'Review your assigned tasks, work on them, and submit them for approval.'}
            </p>
          </div>
        </div>
      </section>

      {isAdmin && (
        <section className="card space-y-4">
          <h2 className="text-xl font-bold">Assign New Task</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              className="input-field"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task title"
            />
            <select className="input-field" value={priority} onChange={(e) => setPriority(e.target.value as 'low' | 'medium' | 'high')}>
              <option value="low">Low priority</option>
              <option value="medium">Medium priority</option>
              <option value="high">High priority</option>
            </select>
            <select className="input-field" value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)}>
              <option value="">Select assignee</option>
              {users
                .filter((item) => ['content_creator', 'video_editor', 'content creator', 'video editor'].includes(String(item.role_slug || item.role_name || '')))
                .map((item) => (
                  <option key={item.id} value={item.id}>{item.name} ({item.role_name || item.role_slug || 'Role'})</option>
                ))}
            </select>
            <input
              type="datetime-local"
              className="input-field"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </div>
          <textarea
            className="input-field min-h-[120px]"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the task, deliverables, and content brief"
          />
          <div className="flex justify-end">
            <Button variant="primary" onClick={createTask}>Assign Task</Button>
          </div>
        </section>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-200">
          {error}
        </div>
      )}

      <section className="card">
        <h2 className="text-xl font-bold mb-4">{isAdmin ? 'All Assigned Work' : 'My Tasks'}</h2>
        {loading ? (
          <div className="flex justify-center py-8"><Spinner size="md" /></div>
        ) : filteredTasks.length === 0 ? (
          <p className="text-slate-600 dark:text-slate-400">No tasks assigned yet.</p>
        ) : (
          <div className="space-y-4">
            {filteredTasks.map((task) => (
              <div key={task.id} className="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold">{task.title}</h3>
                      <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${statusColor[task.status]}`}>
                        {task.status.replace('_', ' ')}
                      </span>
                      <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${priorityColor[task.priority]}`}>
                        {task.priority}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-300">{task.description || 'No description provided.'}</p>
                    <div className="flex flex-wrap gap-4 text-xs text-slate-500 dark:text-slate-400">
                      <span>Assigned by: {task.created_by_name || 'Admin'}</span>
                      <span>Deadline: {formatDate(task.deadline)}</span>
                      <span>Created: {formatDate(task.created_at)}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {!isAdmin && task.status === 'assigned' && (
                      <Button size="sm" variant="primary" onClick={() => updateTaskAction(task.id, 'start')}>Start</Button>
                    )}
                    {!isAdmin && (task.status === 'in_progress' || task.status === 'revision_requested') && (
                      <Button size="sm" variant="primary" onClick={() => updateTaskAction(task.id, 'submit')}>Submit</Button>
                    )}
                    {isAdmin && task.status === 'submitted' && (
                      <>
                        <Button size="sm" variant="primary" onClick={() => updateTaskAction(task.id, 'approve')}>Approve</Button>
                        <Button size="sm" variant="secondary" onClick={() => updateTaskAction(task.id, 'request-revision')}>Request Changes</Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
