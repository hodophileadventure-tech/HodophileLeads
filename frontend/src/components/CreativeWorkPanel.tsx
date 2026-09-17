import React, { useEffect, useMemo, useState } from 'react';
import { Button, Spinner } from './common';
import { useAuth } from '../context/AuthContext';
import { tasksAPI, adminAPI } from '../utils/api-service';
import { getAssignableUsers, getTaskStatusLabel } from '../utils/task-assignment';

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
  attachments?: Array<{ id: string; original_filename: string; file_path: string; mime_type: string }>;
  latestSubmission?: { submission_notes?: string; submitted_by_name?: string; submitted_at?: string; review_notes?: string };
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
  const [attachment, setAttachment] = useState<File | null>(null);
  const [submissionTask, setSubmissionTask] = useState<TaskRecord | null>(null);
  const [submissionNotes, setSubmissionNotes] = useState('');
  const [submissionAttachment, setSubmissionAttachment] = useState<File | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [deadlineFilter, setDeadlineFilter] = useState('all');

  const isAdmin = user?.role === 'admin';
  const normalizedRole = String(user?.role || '').replace(/_/g, ' ');
  const canAssignTasks = isAdmin || normalizedRole === 'content creator';

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const response = await tasksAPI.list();
      const loadedTasks: TaskRecord[] = response.data?.data || [];
      const tasksWithAttachments = await Promise.all(loadedTasks.map(async (task) => {
        try {
          const attachmentResponse = await tasksAPI.listAttachments(task.id);
          const submissionResponse = await tasksAPI.listSubmissions(task.id);
          return {
            ...task,
            attachments: attachmentResponse.data?.data || [],
            latestSubmission: submissionResponse.data?.data?.[0]
          };
        } catch {
          return task;
        }
      }));
      setTasks(tasksWithAttachments);
    } catch (err) {
      console.error('Failed to load tasks', err);
      setError('Could not load tasks.');
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    if (!canAssignTasks) return;
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
    const visibleTasks = canAssignTasks ? tasks : tasks.filter((task) => String(task.assigned_to || '') === String(user.id) || String(task.created_by || '') === String(user.id));

    return [...visibleTasks]
      .filter((task) => {
        const assigneeName = task.assigned_to_name || task.assigned_to || 'Unassigned';
        const matchesSearch = !searchTerm || [task.title, task.description || '', assigneeName].join(' ').toLowerCase().includes(searchTerm.toLowerCase());
        const matchesAssignee = assigneeFilter === 'all' || String(task.assigned_to || '') === assigneeFilter;
        const matchesStatus = statusFilter === 'all' || task.status === statusFilter;
        const matchesPriority = priorityFilter === 'all' || task.priority === priorityFilter;

        if (!matchesSearch || !matchesAssignee || !matchesStatus || !matchesPriority) {
          return false;
        }

        if (deadlineFilter === 'all') return true;

        const deadline = task.deadline ? new Date(task.deadline) : null;
        if (!deadline || Number.isNaN(deadline.getTime())) return false;

        const now = new Date();
        const diffDays = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        if (deadlineFilter === 'overdue') return diffDays < 0;
        if (deadlineFilter === 'today') return diffDays === 0;
        if (deadlineFilter === 'upcoming') return diffDays > 0;
        return true;
      })
      .sort((a, b) => new Date(a.deadline || 0).getTime() - new Date(b.deadline || 0).getTime());
  }, [tasks, user?.id, isAdmin, searchTerm, assigneeFilter, statusFilter, priorityFilter, deadlineFilter]);

  const assignableUsers = useMemo(() => getAssignableUsers(users), [users]);

  const taskMetrics = useMemo(() => ({
    total: filteredTasks.length,
    pending: filteredTasks.filter((task) => task.status === 'assigned').length,
    inProgress: filteredTasks.filter((task) => task.status === 'in_progress').length,
    completed: filteredTasks.filter((task) => task.status === 'submitted' || task.status === 'approved').length,
    overdue: filteredTasks.filter((task) => task.deadline && new Date(task.deadline).getTime() < Date.now() && task.status !== 'approved' && task.status !== 'submitted').length
  }), [filteredTasks]);

  const createTask = async () => {
    if (!canAssignTasks) return;
    if (!title.trim() || !assignedTo || !deadline) {
      setError('Please fill in task title, assignee, and deadline.');
      return;
    }

    try {
      setError('');
      const response = await tasksAPI.create({
        title: title.trim(),
        description: description.trim(),
        assigned_to: assignedTo,
        deadline,
        priority,
      });
      if (attachment) {
        const formData = new FormData();
        formData.append('attachment', attachment);
        await tasksAPI.uploadAttachment(response.data?.data?.id, formData);
      }
      setTitle('');
      setDescription('');
      setAssignedTo('');
      setDeadline('');
      setPriority('medium');
      setAttachment(null);
      await fetchTasks();
    } catch (err) {
      console.error('Failed to create task', err);
      setError('Failed to assign task.');
    }
  };

  const updateTaskAction = async (taskId: string, action: 'start' | 'submit' | 'approve' | 'request-revision') => {
    if (action === 'submit') {
      const task = tasks.find((item) => item.id === taskId);
      if (task) {
        setSubmissionTask(task);
        setSubmissionNotes('');
        setSubmissionAttachment(null);
      }
      return;
    }

    try {
      const methods: Record<Exclude<typeof action, 'submit'>, (id: string, payload?: any) => Promise<any>> = {
        start: tasksAPI.start,
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

  const sendForApproval = async () => {
    if (!submissionTask || !submissionNotes.trim()) {
      setError('Please add submission notes before sending for approval.');
      return;
    }

    try {
      setError('');
      const formData = new FormData();
      formData.append('submission_notes', submissionNotes.trim());
      if (submissionAttachment) formData.append('attachment', submissionAttachment);
      await tasksAPI.submit(submissionTask.id, formData);
      setSubmissionTask(null);
      setSubmissionNotes('');
      setSubmissionAttachment(null);
      await fetchTasks();
    } catch (err) {
      console.error('Failed to send task for approval', err);
      setError('Could not send the task for approval.');
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
              {canAssignTasks
                ? 'Assign work to teammates, then review submissions before approval.'
                : 'Review your assigned tasks, work on them, and submit them for approval.'}
            </p>
          </div>
        </div>
      </section>

      {canAssignTasks && (
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
              {assignableUsers.map((item) => (
                <option key={item.id} value={item.id}>{item.name} {item.role_name || item.role_slug ? `(${item.role_name || item.role_slug})` : ''}</option>
              ))}
            </select>
            <input
              type="datetime-local"
              className="input-field"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
            <input
              type="file"
              className="input-field"
              onChange={(e) => setAttachment(e.target.files?.[0] || null)}
              accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip"
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
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4 mb-4">
          <div>
            <h2 className="text-xl font-bold">{canAssignTasks ? 'Assignment Sheet' : 'My Task Sheet'}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Track every user, deadline, task, and approval in one place.</p>
          </div>
          {canAssignTasks && (
            <div className="flex flex-wrap gap-2">
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                Total: <span className="font-semibold">{taskMetrics.total}</span>
              </div>
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-200">
                Pending: <span className="font-semibold">{taskMetrics.pending}</span>
              </div>
              <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-700 dark:border-sky-700 dark:bg-sky-900/30 dark:text-sky-200">
                In progress: <span className="font-semibold">{taskMetrics.inProgress}</span>
              </div>
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200">
                Completed: <span className="font-semibold">{taskMetrics.completed}</span>
              </div>
            </div>
          )}
        </div>

        {canAssignTasks && (
          <div className="mb-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
            <input
              className="input-field"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search task or user"
            />
            <select className="input-field" value={assigneeFilter} onChange={(e) => setAssigneeFilter(e.target.value)}>
              <option value="all">All users</option>
              {assignableUsers.map((userItem) => (
                <option key={userItem.id} value={userItem.id}>{userItem.name}</option>
              ))}
            </select>
            <select className="input-field" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">All status</option>
              <option value="assigned">Pending</option>
              <option value="in_progress">In progress</option>
              <option value="submitted">Completed</option>
              <option value="revision_requested">Not complete</option>
              <option value="approved">Approved</option>
            </select>
            <select className="input-field" value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}>
              <option value="all">All priority</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
            <select className="input-field" value={deadlineFilter} onChange={(e) => setDeadlineFilter(e.target.value)}>
              <option value="all">All deadlines</option>
              <option value="overdue">Overdue</option>
              <option value="today">Due today</option>
              <option value="upcoming">Upcoming</option>
            </select>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-8"><Spinner size="md" /></div>
        ) : filteredTasks.length === 0 ? (
          <p className="text-slate-600 dark:text-slate-400">No tasks match your current filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700 text-sm">
              <thead>
                <tr className="text-left text-slate-600 dark:text-slate-300">
                  <th className="pb-3 pr-4 font-semibold">User</th>
                  <th className="pb-3 pr-4 font-semibold">Task</th>
                  <th className="pb-3 pr-4 font-semibold">Deadline</th>
                  <th className="pb-3 pr-4 font-semibold">Priority</th>
                  <th className="pb-3 pr-4 font-semibold">Status</th>
                  <th className="pb-3 pr-4 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {filteredTasks.map((task) => (
                  <tr key={task.id} className="align-top">
                    <td className="py-3 pr-4 font-medium text-slate-800 dark:text-slate-100">
                      {task.assigned_to_name || task.assigned_to || 'Unassigned'}
                    </td>
                    <td className="py-3 pr-4">
                      <div className="font-medium text-slate-800 dark:text-slate-100">{task.title}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">{task.description || 'No description provided.'}</div>
                    </td>
                    <td className="py-3 pr-4 text-slate-700 dark:text-slate-200">{formatDate(task.deadline)}</td>
                    <td className="py-3 pr-4">
                      <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${priorityColor[task.priority]}`}>
                        {task.priority}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${statusColor[task.status]}`}>
                        {getTaskStatusLabel(task.status)}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
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
                            <Button size="sm" variant="secondary" onClick={() => updateTaskAction(task.id, 'request-revision')}>Not complete</Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {submissionTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg space-y-4 rounded-xl bg-white p-6 shadow-xl dark:bg-slate-900">
            <div>
              <h2 className="text-xl font-bold">Send Task for Approval</h2>
              <p className="mt-1 text-sm text-slate-500">{submissionTask.title}</p>
            </div>
            <textarea
              className="input-field min-h-[140px]"
              value={submissionNotes}
              onChange={(e) => setSubmissionNotes(e.target.value)}
              placeholder="Describe the completed work, delivered items, and any notes for admin"
            />
            <input
              type="file"
              className="input-field"
              onChange={(e) => setSubmissionAttachment(e.target.files?.[0] || null)}
              accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip"
            />
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setSubmissionTask(null)}>Cancel</Button>
              <Button variant="primary" onClick={sendForApproval}>Send for Approval</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
