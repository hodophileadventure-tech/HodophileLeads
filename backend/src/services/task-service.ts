// ============================================================================
// SERVICE: Task Business Logic
// ============================================================================

import { taskModel } from '../models/Task';
import { taskSubmissionModel } from '../models/TaskSubmission';
import { taskCommentModel } from '../models/TaskComment';
import { taskActivityLogModel } from '../models/TaskActivityLog';
import { notificationModel } from '../models/Notification';
import type {
  Task,
  TaskStatus,
  TaskSubmission,
  TaskComment
} from '../types/task-management';

export class TaskService {
  
  // =========================================================================
  // Task Lifecycle Management
  // =========================================================================

  /**
   * Create a new task
   */
  async createTask(data: {
    title: string;
    description?: string;
    created_by: string;
    assigned_to: string;
    start_date?: string;
    deadline: string;
    priority: string;
  }): Promise<Task> {
    const task = await taskModel.create(data);

    // Log activity
    await taskActivityLogModel.create({
      task_id: task.id,
      action: 'created',
      details: { title: task.title, assigned_to: task.assigned_to },
      performed_by: data.created_by
    });

    // Send notification to assignee
    await notificationModel.create({
      user_id: data.assigned_to,
      entity_type: 'task',
      entity_id: task.id,
      type: 'task_assigned',
      message: `New task: "${task.title}"`,
      payload: {
        task_id: task.id,
        deadline: task.deadline,
        priority: task.priority
      }
    });

    return task;
  }

  /**
   * Start working on a task
   */
  async startTask(taskId: string, userId: string): Promise<Task> {
    const task = await taskModel.findById(taskId);
    if (!task) throw new Error('Task not found');

    if (task.assigned_to !== userId) {
      throw new Error('User is not assigned to this task');
    }

    const updated = await taskModel.updateStatus(taskId, 'in_progress', userId);

    // Set started_at timestamp
    await taskModel.update(taskId, {
      start_date: new Date().toISOString()
    });

    // Log activity
    await taskActivityLogModel.create({
      task_id: taskId,
      action: 'started',
      performed_by: userId
    });

    // Add system comment
    await taskCommentModel.addSystemComment(
      taskId,
      `${updated.assigned_to_name || 'User'} started working on this task`
    );

    return updated;
  }

  /**
   * Submit a completed task
   */
  async submitTask(
    taskId: string,
    userId: string,
    data: { submission_notes?: string }
  ): Promise<{ task: Task; submission: TaskSubmission }> {
    const task = await taskModel.findById(taskId);
    if (!task) throw new Error('Task not found');

    // Validate user can submit
    const isAssigned = task.assigned_to === userId;
    const validStatus = task.status === 'in_progress' || task.status === 'revision_requested';

    if (!isAssigned || !validStatus) {
      throw new Error('User cannot submit this task');
    }

    // Create submission
    const submission = await taskSubmissionModel.create({
      task_id: taskId,
      submission_notes: data.submission_notes,
      submitted_by: userId
    });

    // Update task status
    const updated = await taskModel.updateStatus(taskId, 'submitted', userId);

    // Log activity
    await taskActivityLogModel.create({
      task_id: taskId,
      action: 'submitted',
      details: { submission_id: submission.id },
      performed_by: userId
    });

    // Add system comment
    await taskCommentModel.addSystemComment(
      taskId,
      `${updated.assigned_to_name || 'User'} submitted task for review`
    );

    // Notify creator/admin
    await notificationModel.create({
      user_id: task.created_by,
      entity_type: 'task',
      entity_id: taskId,
      type: 'task_submitted',
      message: `Task "${task.title}" submitted for review`,
      payload: { submission_id: submission.id }
    });

    return { task: updated, submission };
  }

  /**
   * Approve a submitted task
   */
  async approveTask(
    taskId: string,
    approverId: string,
    reviewNotes?: string
  ): Promise<{ task: Task; submission: TaskSubmission }> {
    const task = await taskModel.findById(taskId);
    if (!task) throw new Error('Task not found');

    if (task.status !== 'submitted') {
      throw new Error('Task must be in submitted status to approve');
    }

    // Get latest submission
    const submissions = await taskSubmissionModel.findByTaskId(taskId, 1);
    if (submissions.length === 0) throw new Error('No submission found');
    const submission = submissions[0];

    // Update submission review status
    const reviewed = await taskSubmissionModel.updateReviewStatus(
      submission.id,
      'approved',
      approverId,
      reviewNotes
    );

    // Update task status to approved
    const updated = await taskModel.updateStatus(taskId, 'approved', approverId);

    // Set approved_at
    await taskModel.update(taskId, {});

    // Log activity
    await taskActivityLogModel.create({
      task_id: taskId,
      action: 'approved',
      details: { reviewer_id: approverId, submission_id: submission.id },
      performed_by: approverId
    });

    // Add system comment
    await taskCommentModel.addSystemComment(
      taskId,
      `Task approved by admin`
    );

    // Notify assignee
    await notificationModel.create({
      user_id: task.assigned_to,
      entity_type: 'task',
      entity_id: taskId,
      type: 'task_approved',
      message: `Task "${task.title}" has been approved`,
      payload: {}
    });

    return { task: updated, submission: reviewed };
  }

  /**
   * Request revision on a submitted task
   */
  async requestRevision(
    taskId: string,
    reviewerId: string,
    revisionNotes: string
  ): Promise<{ task: Task; submission: TaskSubmission }> {
    const task = await taskModel.findById(taskId);
    if (!task) throw new Error('Task not found');

    if (task.status !== 'submitted') {
      throw new Error('Task must be in submitted status to request revision');
    }

    // Get latest submission
    const submissions = await taskSubmissionModel.findByTaskId(taskId, 1);
    if (submissions.length === 0) throw new Error('No submission found');
    const submission = submissions[0];

    // Update submission
    const updated = await taskSubmissionModel.updateReviewStatus(
      submission.id,
      'revision_requested',
      reviewerId,
      revisionNotes
    );

    // Update task status
    const taskUpdated = await taskModel.updateStatus(
      taskId,
      'revision_requested',
      reviewerId
    );

    // Log activity
    await taskActivityLogModel.create({
      task_id: taskId,
      action: 'revision_requested',
      details: {
        reviewer_id: reviewerId,
        revision_notes: revisionNotes
      },
      performed_by: reviewerId
    });

    // Add system comment
    await taskCommentModel.addSystemComment(
      taskId,
      `Revision requested: ${revisionNotes}`
    );

    // Notify assignee
    await notificationModel.create({
      user_id: task.assigned_to,
      entity_type: 'task',
      entity_id: taskId,
      type: 'task_revision_requested',
      message: `Revision requested for "${task.title}"`,
      payload: { revision_notes: revisionNotes }
    });

    return { task: taskUpdated, submission: updated };
  }

  /**
   * Cancel a task
   */
  async cancelTask(
    taskId: string,
    cancelledBy: string,
    reason: string
  ): Promise<Task> {
    const cancelled = await taskModel.cancel(taskId, reason, cancelledBy);

    // Log activity
    await taskActivityLogModel.create({
      task_id: taskId,
      action: 'cancelled',
      details: { reason },
      performed_by: cancelledBy
    });

    // Add system comment
    await taskCommentModel.addSystemComment(
      taskId,
      `Task cancelled: ${reason}`
    );

    // Notify assignee
    await notificationModel.create({
      user_id: cancelled.assigned_to,
      entity_type: 'task',
      entity_id: taskId,
      type: 'task_cancelled',
      message: `Task "${cancelled.title}" has been cancelled`,
      payload: { reason }
    });

    return cancelled;
  }

  // =========================================================================
  // Task Queries
  // =========================================================================

  async getTasksForUser(userId: string, role?: string): Promise<Task[]> {
    // If user is admin/manager, show all tasks
    if (role === 'admin' || role === 'manager') {
      return taskModel.findAll({ limit: 100 });
    }

    // Otherwise show only own tasks
    return taskModel.findAll({ assigned_to: userId, limit: 100 });
  }

  async getPendingReviews(): Promise<TaskSubmission[]> {
    return taskSubmissionModel.getPendingReviews();
  }

  async getTaskActivityTimeline(taskId: string): Promise<any[]> {
    return taskActivityLogModel.getTimeline(taskId);
  }

  // =========================================================================
  // Deadline Management
  // =========================================================================

  async checkAndMarkOverdue(): Promise<number> {
    return taskModel.markOverdue();
  }

  async getOverdueTasks(): Promise<Task[]> {
    return taskModel.findAll({ is_overdue: true });
  }
}

export const taskService = new TaskService();
