import React, { useEffect, useMemo, useState } from 'react';
import { Button, Spinner } from './common';
import { useAuth } from '../context/AuthContext';
import { tasksAPI, adminAPI } from '../utils/api-service';
import { getAssignableUsers, isTaskComplete } from '../utils/task-assignment';

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


export const CreativeWorkPanel: React.FC = () => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [users, setUsers] = useState<Array<{ id: string; name: string; role_slug?: string; role_name?: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submissionTask, setSubmissionTask] = useState<TaskRecord | null>(null);
  const [submissionNotes, setSubmissionNotes] = useState('');
  const [submissionAttachment, setSubmissionAttachment] = useState<File | null>(null);
  const [sheetDrafts, setSheetDrafts] = useState<Record<string, { title: string; deadline: string; priority: 'low' | 'medium' | 'high' }>>({});

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

  const assignableUsers = useMemo(() => getAssignableUsers(users), [users]);

  const getLatestTaskForUser = (userId: string) => {
    return [...tasks]
      .filter((task) => String(task.assigned_to || '') === String(userId))
      .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())[0];
  };

  const updateSheetDraft = (userId: string, field: 'title' | 'deadline' | 'priority', value: string) => {
    setSheetDrafts((prev) => ({
      ...prev,
      [userId]: {
        title: prev[userId]?.title ?? '',
        deadline: prev[userId]?.deadline ?? '',
        priority: prev[userId]?.priority ?? 'medium',
        [field]: value,
      }
    }));
  };

  const assignTaskToUser = async (userId: string) => {
    if (!canAssignTasks) return;
    const draft = sheetDrafts[userId] || { title: '', deadline: '', priority: 'medium' };
    if (!draft.title?.trim() || !draft.deadline) {
      setError('Please enter a task and deadline for this user before assigning.');
      return;
    }

    try {
      setError('');
      await tasksAPI.create({
        title: draft.title.trim(),
        description: 'Assigned from assignment sheet',
        assigned_to: userId,
        deadline: draft.deadline,
        priority: draft.priority,
      });
      setSheetDrafts((prev) => ({
        ...prev,
        [userId]: { title: '', deadline: '', priority: 'medium' }
      }));
      await fetchTasks();
    } catch (err) {
      console.error('Failed to assign sheet task', err);
      setError('Failed to save the task to this user.');
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
                  <th className="pb-3 pr-4 font-semibold">Priority</th>
                  <th className="pb-3 pr-4 font-semibold">Done</th>
                  <th className="pb-3 pr-4 font-semibold">Files</th>
                  <th className="pb-3 pr-4 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {canAssignTasks ? assignableUsers.map((member) => {
                  const latestTask = getLatestTaskForUser(member.id);
                  const rowDraft = sheetDrafts[member.id] || { title: '', deadline: '', priority: 'medium' };
                  const done = latestTask ? isTaskComplete(latestTask.status) : false;

                  return (
                    <tr key={member.id} className="align-top">
                      <td className="py-3 pr-4 font-medium text-slate-800 dark:text-slate-100">{member.name}</td>
                      <td className="py-3 pr-4">
                        <input
                          className="input-field min-w-[220px]"
                          value={rowDraft.title}
                          onChange={(e) => updateSheetDraft(member.id, 'title', e.target.value)}
                          placeholder="Write task here"
                        />
                      </td>
                      <td className="py-3 pr-4">
                        <input
                          type="date"
                          className="input-field"
                          value={rowDraft.deadline}
                          onChange={(e) => updateSheetDraft(member.id, 'deadline', e.target.value)}
                        />
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
                        {latestTask?.attachments && latestTask.attachments.length > 0 ? (
                          <div className="flex flex-col gap-1">
                            {latestTask.attachments.map((file) => (
                              <a key={file.id} href={file.file_path} target="_blank" rel="noreferrer" className="text-blue-600 underline text-xs">
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
                          {latestTask && !isAdmin && latestTask.status === 'assigned' && (
                            <Button size="sm" variant="secondary" onClick={() => updateTaskAction(latestTask.id, 'start')}>Start</Button>
                          )}
                          {latestTask && !isAdmin && (latestTask.status === 'in_progress' || latestTask.status === 'revision_requested') && (
                            <Button size="sm" variant="secondary" onClick={() => updateTaskAction(latestTask.id, 'submit')}>Submit</Button>
                          )}
                          {latestTask && canAssignTasks && latestTask.status === 'submitted' && (
                            <>
                              <Button size="sm" variant="primary" onClick={() => updateTaskAction(latestTask.id, 'approve')}>Approve</Button>
                              <Button size="sm" variant="secondary" onClick={() => updateTaskAction(latestTask.id, 'request-revision')}>Not complete</Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                }) : filteredTasks.map((task) => {
                  const done = isTaskComplete(task.status);

                  return (
                    <tr key={task.id} className="align-top">
                      <td className="py-3 pr-4 font-medium text-slate-800 dark:text-slate-100">{task.assigned_to_name || 'You'}</td>
                      <td className="py-3 pr-4">
                        <div className="font-medium text-slate-800 dark:text-slate-100">{task.title}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">{task.description || 'No description provided.'}</div>
                      </td>
                      <td className="py-3 pr-4 text-slate-700 dark:text-slate-200">{task.deadline ? new Date(task.deadline).toLocaleDateString() : 'No deadline'}</td>
                      <td className="py-3 pr-4 capitalize">{task.priority}</td>
                      <td className="py-3 pr-4"><input type="checkbox" checked={done} readOnly className="h-4 w-4" /></td>
                      <td className="py-3 pr-4">
                        {task.attachments && task.attachments.length > 0 ? (
                          <div className="flex flex-col gap-1">
                            {task.attachments.map((file) => (
                              <a key={file.id} href={file.file_path} target="_blank" rel="noreferrer" className="text-blue-600 underline text-xs">
                                Download {file.original_filename}
                              </a>
                            ))}
                          </div>
                        ) : <span className="text-xs text-slate-500">No file</span>}
                      </td>
                      <td className="py-3 pr-4">
                        <div className="flex flex-wrap gap-2">
                          {task.status === 'assigned' && (
                            <Button size="sm" variant="primary" onClick={() => updateTaskAction(task.id, 'start')}>Start</Button>
                          )}
                          {(task.status === 'in_progress' || task.status === 'revision_requested') && (
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
