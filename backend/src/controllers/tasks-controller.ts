// ============================================================================
// CONTROLLER: Task Management API Endpoints
// ============================================================================

import { Router, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { authorizationService } from '../services/authorization-service';
import { taskService } from '../services/task-service';
import { taskModel } from '../models/Task';
import { taskSubmissionModel } from '../models/TaskSubmission';
import { taskCommentModel } from '../models/TaskComment';
import type { Request } from 'express';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    name: string;
    role_id: string;
  };
}

export const tasksController = {
  
  // =========================================================================
  // Create Task
  // =========================================================================
  async createTask(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

      const { title, description, assigned_to, start_date, deadline, priority } = req.body;

      if (!title || !assigned_to || !deadline) {
        return res.status(400).json({
          error: 'Missing required fields: title, assigned_to, deadline'
        });
      }

      const task = await taskService.createTask({
        title,
        description,
        created_by: req.user.id,
        assigned_to,
        start_date,
        deadline,
        priority: priority || 'medium'
      });

      res.status(201).json({ data: task });
    } catch (error: any) {
      console.error('Create task error:', error);
      res.status(500).json({ error: error.message });
    }
  },

  // =========================================================================
  // List Tasks
  // =========================================================================
  async listTasks(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

      const { status, priority, assigned_to, is_overdue } = req.query;

      // Check if user can view all tasks
      const canViewAll = await authorizationService.hasPermission(
        req.user.id,
        'tasks',
        'view_all'
      );

      let tasks;
      if (canViewAll) {
        tasks = await taskModel.findAll({
          status: status as any,
          priority: priority as string,
          assigned_to: assigned_to as string,
          is_overdue: is_overdue === 'true',
          limit: 100
        });
      } else {
        // Show only own tasks
        tasks = await taskModel.findAll({
          assigned_to: req.user.id,
          limit: 100
        });
      }

      res.json({ data: tasks, count: tasks.length });
    } catch (error: any) {
      console.error('List tasks error:', error);
      res.status(500).json({ error: error.message });
    }
  },

  // =========================================================================
  // Get Task Details
  // =========================================================================
  async getTask(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

      const { id } = req.params;
      const task = await taskModel.findById(id);

      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }

      // Check access
      const canAccess = await authorizationService.canAccessTask(req.user.id, id);
      if (!canAccess) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      res.json({ data: task });
    } catch (error: any) {
      console.error('Get task error:', error);
      res.status(500).json({ error: error.message });
    }
  },

  // =========================================================================
  // Start Task
  // =========================================================================
  async startTask(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

      const { id } = req.params;
      const task = await taskService.startTask(id, req.user.id);

      res.json({ data: task, message: 'Task started' });
    } catch (error: any) {
      console.error('Start task error:', error);
      res.status(400).json({ error: error.message });
    }
  },

  // =========================================================================
  // Submit Task
  // =========================================================================
  async submitTask(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

      const { id } = req.params;
      const { submission_notes } = req.body;

      const { task, submission } = await taskService.submitTask(id, req.user.id, {
        submission_notes
      });

      res.json({
        data: { task, submission },
        message: 'Task submitted for review'
      });
    } catch (error: any) {
      console.error('Submit task error:', error);
      res.status(400).json({ error: error.message });
    }
  },

  // =========================================================================
  // Approve Task
  // =========================================================================
  async approveTask(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

      const { id } = req.params;
      const { review_notes } = req.body;

      // Check permission
      const canApprove = await authorizationService.canApproveTask(req.user.id, id);
      if (!canApprove) {
        return res.status(403).json({ error: 'Cannot approve this task' });
      }

      const { task, submission } = await taskService.approveTask(
        id,
        req.user.id,
        review_notes
      );

      res.json({
        data: { task, submission },
        message: 'Task approved'
      });
    } catch (error: any) {
      console.error('Approve task error:', error);
      res.status(400).json({ error: error.message });
    }
  },

  // =========================================================================
  // Request Revision
  // =========================================================================
  async requestRevision(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

      const { id } = req.params;
      const { review_notes } = req.body;

      if (!review_notes) {
        return res.status(400).json({ error: 'review_notes is required' });
      }

      const { task, submission } = await taskService.requestRevision(
        id,
        req.user.id,
        review_notes
      );

      res.json({
        data: { task, submission },
        message: 'Revision requested'
      });
    } catch (error: any) {
      console.error('Request revision error:', error);
      res.status(400).json({ error: error.message });
    }
  },

  // =========================================================================
  // Cancel Task
  // =========================================================================
  async cancelTask(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

      const { id } = req.params;
      const { cancellation_reason } = req.body;

      if (!cancellation_reason) {
        return res.status(400).json({ error: 'cancellation_reason is required' });
      }

      const task = await taskService.cancelTask(id, req.user.id, cancellation_reason);

      res.json({
        data: task,
        message: 'Task cancelled'
      });
    } catch (error: any) {
      console.error('Cancel task error:', error);
      res.status(400).json({ error: error.message });
    }
  },

  // =========================================================================
  // Get Submissions
  // =========================================================================
  async getSubmissions(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

      const { id } = req.params;
      const submissions = await taskSubmissionModel.findByTaskId(id);

      res.json({ data: submissions, count: submissions.length });
    } catch (error: any) {
      console.error('Get submissions error:', error);
      res.status(500).json({ error: error.message });
    }
  },

  // =========================================================================
  // Get Comments
  // =========================================================================
  async getComments(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

      const { id } = req.params;
      const comments = await taskCommentModel.findByTaskId(id);

      res.json({ data: comments, count: comments.length });
    } catch (error: any) {
      console.error('Get comments error:', error);
      res.status(500).json({ error: error.message });
    }
  },

  // =========================================================================
  // Add Comment
  // =========================================================================
  async addComment(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

      const { id } = req.params;
      const { comment_text } = req.body;

      if (!comment_text) {
        return res.status(400).json({ error: 'comment_text is required' });
      }

      const comment = await taskCommentModel.create({
        task_id: id,
        comment_text,
        commented_by: req.user.id,
        is_system_comment: false
      });

      res.status(201).json({ data: comment });
    } catch (error: any) {
      console.error('Add comment error:', error);
      res.status(500).json({ error: error.message });
    }
  },

  // =========================================================================
  // Get Activity Timeline
  // =========================================================================
  async getActivityTimeline(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

      const { id } = req.params;
      const timeline = await taskService.getTaskActivityTimeline(id);

      res.json({ data: timeline, count: timeline.length });
    } catch (error: any) {
      console.error('Get activity timeline error:', error);
      res.status(500).json({ error: error.message });
    }
  }
};
