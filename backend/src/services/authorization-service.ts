// ============================================================================
// SERVICE: Authorization & Permission Management
// ============================================================================

import { query } from '../utils/database';
import { roleModel } from '../models/Role';
import { permissionModel } from '../models/Permission';
import type { Permission, Role } from '../types/task-management';
import type { Request, Response, NextFunction } from 'express';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    name: string;
    role_id: string;
  };
}

export class AuthorizationService {
  
  // =========================================================================
  // Core Permission Checking
  // =========================================================================

  /**
   * Check if user has a specific permission
   */
  async hasPermission(
    userId: string,
    resource: string,
    action: string
  ): Promise<boolean> {
    try {
      if (resource === 'tasks') {
        const qaResult = await query(
          `SELECT EXISTS(
             SELECT 1
             FROM users u
             LEFT JOIN roles r ON r.id = u.role_id
             WHERE u.id = $1
               AND LOWER(REPLACE(COALESCE(r.slug, u.role, ''), ' ', '_')) IN ('qa', 'quality_assurance')
           ) AS is_qa`,
          [userId]
        );
        if (qaResult.rows[0]?.is_qa) return true;
      }

      const result = await query(
        `SELECT EXISTS(
          SELECT 1 FROM role_permissions rp
          JOIN permissions p ON rp.permission_id = p.id
          JOIN users u ON u.role_id = rp.role_id
          WHERE u.id = $1
            AND p.resource = $2
            AND p.action = $3
        ) as has_permission`,
        [userId, resource, action]
      );

      return result.rows[0].has_permission || false;
    } catch (error) {
      console.error('Error checking permission:', error);
      return false;
    }
  }

  /**
   * Get all permissions for a user
   */
  async getUserPermissions(userId: string): Promise<Permission[]> {
    const result = await query(
      `SELECT DISTINCT p.*
       FROM permissions p
       JOIN role_permissions rp ON p.id = rp.permission_id
       JOIN users u ON u.role_id = rp.role_id
       WHERE u.id = $1
       ORDER BY p.resource, p.action`,
      [userId]
    );
    return result.rows as Permission[];
  }

  /**
   * Get role and permissions for user
   */
  async getUserRole(userId: string): Promise<(Role & { permissions: Permission[] }) | null> {
    const userResult = await query(
      `SELECT u.*, r.*
       FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE u.id = $1`,
      [userId]
    );

    if (userResult.rows.length === 0) {
      return null;
    }

    const role = userResult.rows[0];
    const permissions = await this.getRolePermissions(role.id);

    return {
      ...role,
      permissions
    };
  }

  /**
   * Get permissions for a role
   */
  async getRolePermissions(roleId: string): Promise<Permission[]> {
    const result = await query(
      `SELECT p.*
       FROM permissions p
       JOIN role_permissions rp ON p.id = rp.permission_id
       WHERE rp.role_id = $1
       ORDER BY p.resource, p.action`,
      [roleId]
    );
    return result.rows as Permission[];
  }

  // =========================================================================
  // Entity-Level Authorization
  // =========================================================================

  /**
   * Check if user can access a specific task
   */
  async canAccessTask(userId: string, taskId: string): Promise<boolean> {
    try {
      // Employee can see own tasks
      const ownResult = await query(
        'SELECT EXISTS(SELECT 1 FROM tasks WHERE id = $1 AND assigned_to = $2) as is_own',
        [taskId, userId]
      );

      if (ownResult.rows[0].is_own) return true;

      // Admins and managers can see all tasks
      const hasViewAll = await this.hasPermission(userId, 'tasks', 'view_all');
      return hasViewAll;
    } catch (error) {
      console.error('Error checking task access:', error);
      return false;
    }
  }

  /**
   * Check if user can approve a task
   */
  async canApproveTask(userId: string, taskId: string): Promise<boolean> {
    const hasPermission = await this.hasPermission(userId, 'tasks', 'approve');
    if (!hasPermission) return false;

    // Additional: Cannot approve own task
    const taskResult = await query(
      'SELECT created_by FROM tasks WHERE id = $1',
      [taskId]
    );

    if (taskResult.rows.length === 0) return false;
    return taskResult.rows[0].created_by !== userId;
  }

  /**
   * Check if user can delete a task
   */
  async canDeleteTask(userId: string, taskId: string): Promise<boolean> {
    const hasPermission = await this.hasPermission(userId, 'tasks', 'delete');
    if (!hasPermission) return false;

    const taskResult = await query(
      'SELECT status FROM tasks WHERE id = $1',
      [taskId]
    );

    if (taskResult.rows.length === 0) return false;
    return taskResult.rows[0].status === 'assigned';
  }

  /**
   * Check if user can submit a task
   */
  async canSubmitTask(userId: string, taskId: string): Promise<boolean> {
    const hasPermission = await this.hasPermission(userId, 'tasks', 'submit');
    if (!hasPermission) return false;

    const taskResult = await query(
      'SELECT assigned_to, status FROM tasks WHERE id = $1',
      [taskId]
    );

    if (taskResult.rows.length === 0) return false;
    const task = taskResult.rows[0];

    return (
      task.assigned_to === userId &&
      (task.status === 'in_progress' || task.status === 'revision_requested')
    );
  }

  // =========================================================================
  // Middleware Factories
  // =========================================================================

  /**
   * Express middleware for permission checking
   */
  requirePermission(resource: string, action: string) {
    return async (
      req: AuthenticatedRequest,
      res: Response,
      next: NextFunction
    ) => {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const hasPermission = await this.hasPermission(
        req.user.id,
        resource,
        action
      );

      if (!hasPermission) {
        return res.status(403).json({
          error: 'Forbidden',
          message: `Missing permission: ${resource}.${action}`
        });
      }

      next();
    };
  }

  /**
   * Express middleware for role checking
   */
  requireRole(allowedRoles: string[]) {
    return async (
      req: AuthenticatedRequest,
      res: Response,
      next: NextFunction
    ) => {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const userRole = await query(
        'SELECT slug FROM roles WHERE id = $1',
        [req.user.role_id]
      );

      if (userRole.rows.length === 0) {
        return res.status(401).json({ error: 'Invalid user role' });
      }

      const roleSlug = userRole.rows[0].slug;

      if (!allowedRoles.includes(roleSlug)) {
        return res.status(403).json({
          error: 'Forbidden',
          message: `Required role(s): ${allowedRoles.join(', ')}`
        });
      }

      next();
    };
  }
}

export const authorizationService = new AuthorizationService();
