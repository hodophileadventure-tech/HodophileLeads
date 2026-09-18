import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Clock3, Flag, ListFilter, Sparkles } from 'lucide-react';
import { Button, Spinner } from './common';
import { useAuth } from '../context/AuthContext';
import { tasksAPI, adminAPI } from '../utils/api-service';
import { getAssignableUsers, isTaskComplete } from '../utils/task-assignment';
import { resolveAssetUrl } from '../utils/resolveAssetUrl';
import { formatKarachiDateTime, parseKarachiDateTimeToISOString, toKarachiDateTimeInputValue } from '../utils/helpers';

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

const taskAssetBaseUrl = import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? 'http://localhost:5000/api' : '/api');


export const CreativeWorkPanel: React.FC = () => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [users, setUsers] = useState<Array<{ id: string; name: string; role_slug?: string; role_name?: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submissionTask, setSubmissionTask] = useState<TaskRecord | null>(null);
  const [submissionNotes, setSubmissionNotes] = useState('');
  const [submissionAttachment, setSubmissionAttachment] = useState<File | null>(null);
  const [sheetDrafts, setSheetDrafts] = useState<Record<string, { title: string; deadline: string; priority: 'low' | 'medium' | 'high'; referenceFiles: File[] }>>({});
  const [exporting, setExporting] = useState(false);
  const [exportAssigneeId, setExportAssigneeId] = useState('');
  const [taskFilter, setTaskFilter] = useState<'all' | 'assigned' | 'in_progress' | 'submitted' | 'revision_requested' | 'approved'>('all');
  const [activityToast, setActivityToast] = useState('');
  const [editingTask, setEditingTask] = useState<TaskRecord | null>(null);
  const [editDraft, setEditDraft] = useState({ title: '', deadline: '', priority: 'medium' as 'low' | 'medium' | 'high' });

  const isAdmin = user?.role === 'admin';
  const normalizedRole = String(user?.role || '').replace(/_/g, ' ');
  const canAssignTasks = ['admin', 'manager', 'sales manager', 'content creator'].includes(normalizedRole);

  const notifyActivity = (message: string) => {
    setActivityToast(message);
    window.setTimeout(() => setActivityToast(''), 3600);
  };

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const response = await tasksAPI.list();
      const loadedTasks: TaskRecord[] = response.data?.data || [];
      const tasksWithAttachments = await Promise.all(loadedTasks.map(async (task) => {
        let attachments = task.attachments || [];
        let latestSubmission = task.latestSubmission;
        try {
          const attachmentResponse = await tasksAPI.listAttachments(task.id);
          attachments = attachmentResponse.data?.data || [];
        } catch {
          // Keep the task visible even if an auxiliary attachment request fails.
        }
        try {
          const submissionResponse = await tasksAPI.listSubmissions(task.id);
          latestSubmission = submissionResponse.data?.data?.[0];
        } catch {
          // Submission metadata is optional; attachment links should still render.
        }
        return { ...task, attachments, latestSubmission };
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

  const assignableUsers = useMemo(() => getAssignableUsers(users), [users]);

  const getLatestTaskForUser = (userId: string) => {
    return [...tasks]
      .filter((task) => String(task.assigned_to || '') === String(userId))
      .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())[0];
  };

  const getTasksForUser = (userId: string) => tasks.filter((task) => String(task.assigned_to || '') === String(userId));

  const getSubmittedTaskForUser = (userId: string) => getTasksForUser(userId)
    .filter((task) => task.status === 'submitted')
    .sort((a, b) => new Date(b.submitted_at || b.created_at || 0).getTime() - new Date(a.submitted_at || a.created_at || 0).getTime())[0];

  const updateSheetDraft = (userId: string, field: 'title' | 'deadline' | 'priority', value: string) => {
    setSheetDrafts((prev) => ({
      ...prev,
      [userId]: {
        title: prev[userId]?.title ?? '',
        deadline: prev[userId]?.deadline ?? '',
        priority: prev[userId]?.priority ?? 'medium',
        referenceFiles: prev[userId]?.referenceFiles ?? [],
        [field]: value,
      }
    }));
  };

  const updateSheetReferenceFiles = (userId: string, files: File[]) => {
    setSheetDrafts((prev) => ({
      ...prev,
      [userId]: {
        title: prev[userId]?.title ?? '',
        deadline: prev[userId]?.deadline ?? '',
        priority: prev[userId]?.priority ?? 'medium',
        referenceFiles: files,
      }
    }));
  };

  const assignTaskToUser = async (userId: string) => {
    if (!canAssignTasks) return;
    const draft = sheetDrafts[userId] || { title: '', deadline: '', priority: 'medium' as const, referenceFiles: [] };
    if (!draft.title?.trim() || !draft.deadline) {
      setError('Please enter a task and deadline for this user before assigning.');
      return;
    }

    try {
      setError('');
      const response = await tasksAPI.create({
        title: draft.title.trim(),
        description: 'Assigned from assignment sheet',
        assigned_to: userId,
        deadline: parseKarachiDateTimeToISOString(draft.deadline),
        priority: draft.priority,
      });
      if (draft.referenceFiles.length > 0) {
        const formData = new FormData();
        draft.referenceFiles.forEach((file) => formData.append('attachment', file));
        await tasksAPI.uploadAttachments(response.data?.data?.id, formData);
      }
      setSheetDrafts((prev) => ({
        ...prev,
        [userId]: { title: '', deadline: '', priority: 'medium', referenceFiles: [] }
      }));
      notifyActivity(`Task assigned to ${users.find((member) => String(member.id) === String(userId))?.name || 'team member'}`);
      await fetchTasks();
    } catch (err) {
      console.error('Failed to assign sheet task', err);
      setError('Failed to save the task to this user.');
    }
  };

  const exportTaskSheet = async () => {
    try {
      setExporting(true);
      const response = await tasksAPI.exportSpreadsheet(exportAssigneeId || undefined);
      const url = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      const selectedName = assignableUsers.find((member) => String(member.id) === exportAssigneeId)?.name;
      const filenamePart = selectedName ? selectedName.toLowerCase().replace(/[^a-z0-9]+/g, '-') : 'all';
      link.download = `tripnexus-tasks-${filenamePart}-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      notifyActivity('Excel task sheet downloaded');
    } catch (err) {
      console.error('Failed to export task sheet', err);
      setError('Could not export the task sheet.');
    } finally {
      setExporting(false);
    }
  };

  const openTaskEditor = (task: TaskRecord) => {
    setEditingTask(task);
    setEditDraft({
      title: task.title,
      deadline: toKarachiDateTimeInputValue(task.deadline),
      priority: task.priority
    });
  };

  const saveTaskEdit = async () => {
    if (!editingTask || !editDraft.title.trim() || !editDraft.deadline) return;
    try {
      await tasksAPI.update(editingTask.id, {
        title: editDraft.title.trim(),
        assigned_to: editingTask.assigned_to || '',
        deadline: parseKarachiDateTimeToISOString(editDraft.deadline),
        priority: editDraft.priority
      });
      setEditingTask(null);
      notifyActivity('Task details updated');
      await fetchTasks();
    } catch (err) {
      console.error('Failed to update task', err);
      setError('Could not update this task.');
    }
  };

  const deleteTask = async (task: TaskRecord) => {
    if (!window.confirm(`Delete "${task.title}"? This cannot be undone.`)) return;
    try {
      await tasksAPI.delete(task.id);
      notifyActivity('Task deleted');
      await fetchTasks();
    } catch (err) {
      console.error('Failed to delete task', err);
      setError('Only pending tasks can be deleted.');
    }
  };

  const filteredTasks = useMemo(() => {
    if (!user?.id) return [];
    const visibleTasks = canAssignTasks ? tasks : tasks.filter((task) => String(task.assigned_to || '') === String(user.id) || String(task.created_by || '') === String(user.id));
    return [...visibleTasks].sort((a, b) => new Date(a.deadline || 0).getTime() - new Date(b.deadline || 0).getTime());
  }, [tasks, user?.id, canAssignTasks]);

  const taskMetrics = useMemo(() => ({
    total: filteredTasks.length,
    pending: filteredTasks.filter((task) => task.status === 'assigned').length,
    inProgress: filteredTasks.filter((task) => task.status === 'in_progress').length,
    completed: filteredTasks.filter((task) => task.status === 'submitted' || task.status === 'approved').length,
    overdue: filteredTasks.filter((task) => task.deadline && new Date(task.deadline).getTime() < Date.now() && task.status !== 'approved' && task.status !== 'submitted').length
  }), [filteredTasks]);

  const taskCountByUser = useMemo(() => {
    return filteredTasks.reduce<Record<string, number>>((counts, task) => {
      const userId = String(task.assigned_to || '');
      counts[userId] = (counts[userId] || 0) + 1;
      return counts;
    }, {});
  }, [filteredTasks]);

  const visibleTaskRows = useMemo(() => {
    if (taskFilter === 'all') return filteredTasks;
    return filteredTasks.filter((task) => task.status === taskFilter);
  }, [filteredTasks, taskFilter]);

  const statusMeta = (status: TaskRecord['status']) => {
    const meta: Record<TaskRecord['status'], { label: string; className: string }> = {
      assigned: { label: 'Pending', className: 'bg-amber-50 text-amber-700 ring-amber-200' },
      in_progress: { label: 'In progress', className: 'bg-sky-50 text-sky-700 ring-sky-200' },
      submitted: { label: 'Submitted', className: 'bg-violet-50 text-violet-700 ring-violet-200' },
      revision_requested: { label: 'Needs revision', className: 'bg-rose-50 text-rose-700 ring-rose-200' },
      approved: { label: 'Approved', className: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
      cancelled: { label: 'Cancelled', className: 'bg-slate-100 text-slate-600 ring-slate-200' },
    };
    return meta[status];
  };

  const priorityMeta = (priority: TaskRecord['priority']) => ({
    low: 'text-slate-500',
    medium: 'text-amber-600',
    high: 'text-rose-600'
  })[priority];

  const isCurrentUserAssignee = (task: TaskRecord) => String(task.assigned_to || '') === String(user?.id || '');

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
      notifyActivity(action === 'start' ? 'Task moved to In progress' : action === 'approve' ? 'Task approved successfully' : 'Revision requested from assignee');
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
      notifyActivity('Task submitted for approval');
      await fetchTasks();
    } catch (err) {
      console.error('Failed to send task for approval', err);
      setError('Could not send the task for approval.');
    }
  };

  return (
    <div className="space-y-6">
      {activityToast && (
        <div className="toast-success fixed right-5 top-20 z-[60] flex items-center gap-3 rounded-xl border border-emerald-200 bg-white px-4 py-3 text-sm font-semibold text-emerald-800 shadow-xl">
          <CheckCircle2 className="h-5 w-5 text-emerald-500" />
          {activityToast}
        </div>
      )}
      <section className="card">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-emerald-700">
              <Sparkles className="h-3.5 w-3.5" /> Live workflow
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              {isAdmin ? 'Task Assignment Center' : `${roleLabel(user?.role)} Workspace`}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-400">
              {canAssignTasks
                ? 'Coordinate the team, keep priorities visible, and move submitted work through approval.'
                : 'See what needs your attention, submit finished work, and keep the handoff moving.'}
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" /> Synced just now
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'All tasks', value: taskMetrics.total, icon: ListFilter, tone: 'text-slate-700 bg-slate-100' },
          { label: 'Needs action', value: taskMetrics.pending + taskMetrics.overdue, icon: AlertCircle, tone: 'text-rose-700 bg-rose-100' },
          { label: 'In progress', value: taskMetrics.inProgress, icon: Clock3, tone: 'text-sky-700 bg-sky-100' },
          { label: 'Completed', value: taskMetrics.completed, icon: CheckCircle2, tone: 'text-emerald-700 bg-emerald-100' }
        ].map(({ label, value, icon: Icon, tone }) => (
          <div key={label} className="card !p-4 transition-transform duration-200 hover:-translate-y-0.5">
            <div className="flex items-start justify-between">
              <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${tone}`}><Icon className="h-4 w-4" /></span>
              <span className="text-2xl font-bold text-slate-900 dark:text-white">{value}</span>
            </div>
            <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
          </div>
        ))}
      </section>

      {canAssignTasks && (
        <section className="card space-y-4">
          <h2 className="text-xl font-bold">Sheet View Assignment</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Enter the task in the row for each person. The task is assigned automatically to that user when you click Assign.
          </p>
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
            {canAssignTasks && (
              <p className="mt-2 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                Pending tasks can be edited or deleted from the Manage task column.
              </p>
            )}
          </div>
          {canAssignTasks && (
            <div className="flex flex-wrap items-center gap-2">
              <select
                className="input-field min-w-[190px]"
                value={exportAssigneeId}
                onChange={(event) => setExportAssigneeId(event.target.value)}
                aria-label="Choose tasks to export"
              >
                <option value="">All team tasks</option>
                {assignableUsers.map((member) => (
                  <option key={member.id} value={member.id}>{member.name}'s tasks</option>
                ))}
              </select>
              <Button size="sm" variant="secondary" onClick={exportTaskSheet} loading={exporting}>
                Export Excel
              </Button>
            </div>
          )}
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

        <div className="mb-5 flex flex-wrap items-center gap-2 border-b border-slate-100 pb-4 dark:border-slate-800">
          <span className="mr-2 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            <ListFilter className="h-4 w-4" /> View
          </span>
          {[
            { value: 'all', label: 'All' },
            { value: 'assigned', label: 'Pending' },
            { value: 'in_progress', label: 'In progress' },
            { value: 'submitted', label: 'Submitted' },
            { value: 'revision_requested', label: 'Needs revision' },
            { value: 'approved', label: 'Approved' }
          ].map((filter) => (
            <button
              key={filter.value}
              type="button"
              onClick={() => setTaskFilter(filter.value as typeof taskFilter)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${taskFilter === filter.value ? 'bg-slate-900 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'}`}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-8"><Spinner size="md" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700 text-sm">
              <thead>
                <tr className="text-left text-slate-600 dark:text-slate-300">
                  <th className="pb-3 pr-4 font-semibold">Name</th>
                  <th className="pb-3 pr-4 font-semibold">Task</th>
                  <th className="pb-3 pr-4 font-semibold">Deadline</th>
                  <th className="pb-3 pr-4 font-semibold">Assigned at</th>
                  <th className="pb-3 pr-4 font-semibold">Priority</th>
                  <th className="pb-3 pr-4 font-semibold">Done</th>
                  <th className="pb-3 pr-4 font-semibold">Reference file</th>
                  <th className="pb-3 pr-4 font-semibold">Files</th>
                  <th className="pb-3 pr-4 font-semibold">Manage task</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {canAssignTasks ? assignableUsers.map((member) => {
                  const latestTask = getLatestTaskForUser(member.id);
                  const userTasks = getTasksForUser(member.id);
                  const submittedTask = getSubmittedTaskForUser(member.id);
                  const userFiles = userTasks.flatMap((task) => (task.attachments || []).map((file) => ({ ...file, taskTitle: task.title })));
                  const rowDraft = sheetDrafts[member.id] || { title: '', deadline: '', priority: 'medium', referenceFiles: [] };
                  const done = latestTask ? isTaskComplete(latestTask.status) : false;

                  return (
                    <tr key={member.id} className="align-top">
                      <td className="py-3 pr-4 font-medium text-slate-800 dark:text-slate-100">
                        <div>{member.name}</div>
                        <div className="text-xs font-normal text-slate-500 dark:text-slate-400">
                          {taskCountByUser[String(member.id)] || 0} assigned
                        </div>
                      </td>
                      <td className="py-3 pr-4">
                        <input
                          className="input-field min-w-[220px]"
                          value={rowDraft.title}
                          onChange={(e) => updateSheetDraft(member.id, 'title', e.target.value)}
                          placeholder="Write task here"
                        />
                        {userFiles.length > 0 && (
                          <div className="mt-2 max-w-[220px] rounded-md bg-emerald-50 px-2 py-1.5 text-xs dark:bg-emerald-950/30">
                            <div className="font-semibold text-emerald-700 dark:text-emerald-300">Submitted files</div>
                            {userFiles.map((file) => (
                              <a
                                key={`task-${file.id}`}
                                href={resolveAssetUrl(file.file_path, taskAssetBaseUrl)}
                                target="_blank"
                                rel="noreferrer"
                                className="block truncate text-emerald-700 underline dark:text-emerald-300"
                                title={file.taskTitle}
                              >
                                {file.original_filename} <span className="no-underline opacity-70">({file.taskTitle})</span>
                              </a>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="py-3 pr-4">
                        <input
                          type="datetime-local"
                          className="input-field"
                          value={rowDraft.deadline}
                          onChange={(e) => updateSheetDraft(member.id, 'deadline', e.target.value)}
                        />
                      </td>
                      <td className="py-3 pr-4 text-slate-700 dark:text-slate-200">
                        {latestTask?.created_at ? new Date(latestTask.created_at).toLocaleString() : 'Not assigned'}
                      </td>
                      <td className="py-3 pr-4">
                        <select
                          className="input-field"
                          value={rowDraft.priority}
                          onChange={(e) => updateSheetDraft(member.id, 'priority', e.target.value as 'low' | 'medium' | 'high')}
                        >
                          <option value="low">Low</option>
                          <option value="medium">Medium</option>
                          <option value="high">High</option>
                        </select>
                      </td>
                      <td className="py-3 pr-4">
                        <input type="checkbox" checked={done} readOnly className="h-4 w-4" />
                      </td>
                      <td className="py-3 pr-4">
                        <input
                          type="file"
                          className="input-field min-w-[220px] text-xs"
                          multiple
                          onChange={(e) => updateSheetReferenceFiles(member.id, Array.from(e.target.files || []))}
                          accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.txt"
                        />
                        {rowDraft.referenceFiles.length > 0 && (
                          <div className="mt-1 max-w-[220px] text-xs text-slate-500">
                            {rowDraft.referenceFiles.map((file) => file.name).join(', ')}
                          </div>
                        )}
                        {latestTask?.attachments && latestTask.attachments.length > 0 && (
                          <div className="mt-2 rounded-md bg-emerald-50 px-2 py-1.5 text-xs dark:bg-emerald-950/30">
                            <div className="font-semibold text-emerald-700 dark:text-emerald-300">Submitted files</div>
                            {latestTask.attachments.map((file) => (
                              <a
                                key={`visible-${file.id}`}
                                href={resolveAssetUrl(file.file_path, taskAssetBaseUrl)}
                                target="_blank"
                                rel="noreferrer"
                                className="block truncate text-emerald-700 underline dark:text-emerald-300"
                              >
                                {file.original_filename}
                              </a>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="py-3 pr-4">
                        {userFiles.length > 0 ? (
                          <div className="flex flex-col gap-1">
                            {userFiles.map((file) => (
                              <a key={file.id} href={resolveAssetUrl(file.file_path, taskAssetBaseUrl)} target="_blank" rel="noreferrer" className="text-blue-600 underline text-xs">
                                Download {file.original_filename}
                              </a>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-500">No file</span>
                        )}
                      </td>
                      <td className="py-3 pr-4">
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" variant="primary" onClick={() => assignTaskToUser(member.id)}>Assign</Button>
                          {latestTask && canAssignTasks && latestTask.status === 'assigned' && (
                            <>
                              <Button size="sm" variant="secondary" onClick={() => openTaskEditor(latestTask)}>Edit</Button>
                              <Button size="sm" variant="danger" onClick={() => deleteTask(latestTask)}>Delete</Button>
                            </>
                          )}
                          {latestTask && !isAdmin && isCurrentUserAssignee(latestTask) && latestTask.status === 'assigned' && (
                            <Button size="sm" variant="secondary" onClick={() => updateTaskAction(latestTask.id, 'start')}>Start</Button>
                          )}
                          {latestTask && !isAdmin && isCurrentUserAssignee(latestTask) && (latestTask.status === 'in_progress' || latestTask.status === 'revision_requested') && (
                            <Button size="sm" variant="secondary" onClick={() => updateTaskAction(latestTask.id, 'submit')}>Submit</Button>
                          )}
                          {submittedTask && canAssignTasks && (
                            <>
                              <Button size="sm" variant="primary" onClick={() => updateTaskAction(submittedTask.id, 'approve')}>Approve</Button>
                              <Button size="sm" variant="secondary" onClick={() => updateTaskAction(submittedTask.id, 'request-revision')}>Not complete</Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                }) : visibleTaskRows.map((task) => {
                  const done = isTaskComplete(task.status);

                  return (
                    <tr key={task.id} className="align-top">
                      <td className="py-3 pr-4 font-medium text-slate-800 dark:text-slate-100">{task.assigned_to_name || 'You'}</td>
                      <td className="py-3 pr-4">
                        <div className="font-medium text-slate-800 dark:text-slate-100">{task.title}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">{task.description || 'No description provided.'}</div>
                      </td>
                      <td className="py-3 pr-4 text-slate-700 dark:text-slate-200">{task.deadline ? formatKarachiDateTime(task.deadline) : 'No deadline'}</td>
                      <td className="py-3 pr-4 text-slate-700 dark:text-slate-200">{task.created_at ? new Date(task.created_at).toLocaleString() : 'Unknown'}</td>
                      <td className={`py-3 pr-4 font-semibold capitalize ${priorityMeta(task.priority)}`}><Flag className="mr-1 inline h-3.5 w-3.5" />{task.priority}</td>
                      <td className="py-3 pr-4"><input type="checkbox" checked={done} readOnly className="h-4 w-4" /></td>
                      <td className="py-3 pr-4">
                        {task.attachments && task.attachments.length > 0 ? (
                          <div className="flex flex-col gap-1">
                            {task.attachments.map((file) => (
                              <a key={file.id} href={resolveAssetUrl(file.file_path, taskAssetBaseUrl)} target="_blank" rel="noreferrer" className="text-blue-600 underline text-xs">
                                Download {file.original_filename}
                              </a>
                            ))}
                          </div>
                        ) : <span className="text-xs text-slate-500">No file</span>}
                      </td>
                      <td className="py-3 pr-4">
                        <div className="flex flex-wrap gap-2">
                          {isCurrentUserAssignee(task) && task.status === 'assigned' && (
                            <Button size="sm" variant="primary" onClick={() => updateTaskAction(task.id, 'start')}>Start</Button>
                          )}
                          {isCurrentUserAssignee(task) && (task.status === 'in_progress' || task.status === 'revision_requested') && (
                            <Button size="sm" variant="secondary" onClick={() => updateTaskAction(task.id, 'submit')}>Submit</Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {canAssignTasks && (
        <section className="card">
          <div className="mb-4">
            <h2 className="text-xl font-bold">All Assigned Tasks</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              One row per task, so you can compare assignees, status, priority, and deadlines at a glance.
            </p>
          </div>

          {filteredTasks.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">No tasks have been assigned yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-700">
                <thead>
                  <tr className="text-left text-slate-600 dark:text-slate-300">
                    <th className="pb-3 pr-4 font-semibold">Assigned to</th>
                    <th className="pb-3 pr-4 font-semibold">Task</th>
                    <th className="pb-3 pr-4 font-semibold">Status</th>
                    <th className="pb-3 pr-4 font-semibold">Priority</th>
                    <th className="pb-3 pr-4 font-semibold">Deadline</th>
                    <th className="pb-3 pr-4 font-semibold">Assigned at</th>
                    <th className="pb-3 pr-4 font-semibold">Assigned by</th>
                    <th className="pb-3 pr-4 font-semibold">Manage</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {visibleTaskRows.map((task) => (
                    <tr key={task.id} className="align-top">
                      <td className="py-3 pr-4 font-medium text-slate-800 dark:text-slate-100">
                        {task.assigned_to_name || 'Unknown user'}
                      </td>
                      <td className="py-3 pr-4">
                        <div className="font-medium text-slate-800 dark:text-slate-100">{task.title}</div>
                        {task.description && (
                          <div className="mt-1 max-w-md text-xs text-slate-500 dark:text-slate-400">{task.description}</div>
                        )}
                      </td>
                      <td className="py-3 pr-4">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${statusMeta(task.status).className}`}>
                          {statusMeta(task.status).label}
                        </span>
                      </td>
                      <td className={`py-3 pr-4 font-semibold capitalize ${priorityMeta(task.priority)}`}><Flag className="mr-1 inline h-3.5 w-3.5" />{task.priority}</td>
                      <td className="py-3 pr-4 text-slate-700 dark:text-slate-200">
                        {task.deadline ? formatKarachiDateTime(task.deadline) : 'No deadline'}
                      </td>
                      <td className="py-3 pr-4 text-slate-700 dark:text-slate-200">
                        {task.created_at ? new Date(task.created_at).toLocaleString() : 'Unknown'}
                      </td>
                      <td className="py-3 pr-4 text-slate-700 dark:text-slate-200">
                        {task.created_by_name || 'Unknown user'}
                      </td>
                      <td className="py-3 pr-4">
                        {task.status === 'assigned' ? (
                          <div className="flex flex-wrap gap-2">
                            <Button size="sm" variant="secondary" onClick={() => openTaskEditor(task)}>Edit</Button>
                            <Button size="sm" variant="danger" onClick={() => deleteTask(task)}>Delete</Button>
                          </div>
                        ) : <span className="text-xs text-slate-400">Locked after start</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {editingTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-lg space-y-5 rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600">Task management</p>
              <h2 className="mt-1 text-xl font-bold text-slate-900 dark:text-white">Edit assigned task</h2>
              <p className="mt-1 text-sm text-slate-500">Update the pending task before work begins.</p>
            </div>
            <input
              className="input-field"
              value={editDraft.title}
              onChange={(event) => setEditDraft((draft) => ({ ...draft, title: event.target.value }))}
              placeholder="Task title"
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-medium text-slate-600">
                Deadline
                <input
                  type="datetime-local"
                  className="input-field mt-1"
                  value={editDraft.deadline}
                  onChange={(event) => setEditDraft((draft) => ({ ...draft, deadline: event.target.value }))}
                />
              </label>
              <label className="text-sm font-medium text-slate-600">
                Priority
                <select
                  className="input-field mt-1"
                  value={editDraft.priority}
                  onChange={(event) => setEditDraft((draft) => ({ ...draft, priority: event.target.value as 'low' | 'medium' | 'high' }))}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setEditingTask(null)}>Cancel</Button>
              <Button variant="primary" onClick={saveTaskEdit}>Save changes</Button>
            </div>
          </div>
        </div>
      )}

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
