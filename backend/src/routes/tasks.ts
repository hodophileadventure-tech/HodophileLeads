// ============================================================================
// ROUTES: Task Management API Endpoints
// ============================================================================

import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { authorizationService } from '../services/authorization-service';
import { tasksController } from '../controllers/tasks-controller';

export const tasksRouter = Router();

// ============================================================================
// Apply auth middleware to all routes
// ============================================================================
tasksRouter.use(authMiddleware);

// ============================================================================
// Task Creation & Management
// ============================================================================

/**
 * POST /tasks
 * Create a new task
 * Required permission: tasks.create
 */
tasksRouter.post(
  '/',
  authorizationService.requirePermission('tasks', 'create'),
  tasksController.createTask
);

/**
 * GET /tasks
 * List tasks (filtered by user role)
 * Required permission: tasks.view or tasks.view_all
 */
tasksRouter.get(
  '/',
  authorizationService.requirePermission('tasks', 'view'),
  tasksController.listTasks
);

/**
 * GET /tasks/:id
 * Get specific task details
 * Required permission: tasks.view (with entity-level authorization)
 */
tasksRouter.get(
  '/:id',
  authorizationService.requirePermission('tasks', 'view'),
  tasksController.getTask
);

// ============================================================================
// Task Workflow Actions
// ============================================================================

/**
 * POST /tasks/:id/start
 * Start working on a task
 * Required permission: tasks.start
 */
tasksRouter.post(
  '/:id/start',
  authorizationService.requirePermission('tasks', 'start'),
  tasksController.startTask
);

/**
 * POST /tasks/:id/submit
 * Submit a completed task
 * Required permission: tasks.submit
 */
tasksRouter.post(
  '/:id/submit',
  authorizationService.requirePermission('tasks', 'submit'),
  tasksController.submitTask
);

/**
 * POST /tasks/:id/approve
 * Approve a submitted task
 * Required permission: tasks.approve
 */
tasksRouter.post(
  '/:id/approve',
  authorizationService.requirePermission('tasks', 'approve'),
  tasksController.approveTask
);

/**
 * POST /tasks/:id/request-revision
 * Request revision on a submitted task
 * Required permission: tasks.request_revision
 */
tasksRouter.post(
  '/:id/request-revision',
  authorizationService.requirePermission('tasks', 'request_revision'),
  tasksController.requestRevision
);

/**
 * POST /tasks/:id/cancel
 * Cancel a task
 * Required permission: tasks.cancel
 */
tasksRouter.post(
  '/:id/cancel',
  authorizationService.requirePermission('tasks', 'cancel'),
  tasksController.cancelTask
);

// ============================================================================
// Task Submissions & Reviews
// ============================================================================

/**
 * GET /tasks/:id/submissions
 * Get all submissions for a task
 * Required permission: tasks.review or tasks.view
 */
tasksRouter.get(
  '/:id/submissions',
  authorizationService.requirePermission('tasks', 'view'),
  tasksController.getSubmissions
);

// ============================================================================
// Comments & Discussion
// ============================================================================

/**
 * GET /tasks/:id/comments
 * Get all comments on a task
 * Required permission: tasks.view
 */
tasksRouter.get(
  '/:id/comments',
  authorizationService.requirePermission('tasks', 'view'),
  tasksController.getComments
);

/**
 * POST /tasks/:id/comments
 * Add a comment to a task
 * Required permission: tasks.view
 */
tasksRouter.post(
  '/:id/comments',
  authorizationService.requirePermission('tasks', 'view'),
  tasksController.addComment
);

// ============================================================================
// Activity & History
// ============================================================================

/**
 * GET /tasks/:id/activity
 * Get activity timeline for a task
 * Required permission: tasks.view
 */
tasksRouter.get(
  '/:id/activity',
  authorizationService.requirePermission('tasks', 'view'),
  tasksController.getActivityTimeline
);

export default tasksRouter;
