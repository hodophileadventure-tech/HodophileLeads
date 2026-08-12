// ============================================================================
// MODEL: Task Activity Log Management
// ============================================================================

import { query } from '../utils/database';
import type { TaskActivityLog } from '../types/task-management';

export const taskActivityLogModel = {
  
  async create(data: {
    task_id: string;
    action: string;
    details?: Record<string, any>;
    performed_by?: string;
  }): Promise<TaskActivityLog> {
    const result = await query(
      `INSERT INTO task_activity_logs (
        task_id, action, details, performed_by
      ) VALUES ($1, $2, $3, $4)
      RETURNING *`,
      [
        data.task_id,
        data.action,
        data.details ? JSON.stringify(data.details) : null,
        data.performed_by || null
      ]
    );
    return result.rows[0] as TaskActivityLog;
  },

  async findByTaskId(taskId: string): Promise<TaskActivityLog[]> {
    const result = await query(
      `SELECT tal.*, u.name as performed_by_name
       FROM task_activity_logs tal
       LEFT JOIN users u ON tal.performed_by = u.id
       WHERE tal.task_id = $1
       ORDER BY tal.performed_at ASC`,
      [taskId]
    );
    return result.rows as TaskActivityLog[];
  },

  async getTimeline(taskId: string): Promise<TaskActivityLog[]> {
    // Get activity timeline with formatted details
    const result = await query(
      `SELECT tal.*, u.name as performed_by_name, u.email
       FROM task_activity_logs tal
       LEFT JOIN users u ON tal.performed_by = u.id
       WHERE tal.task_id = $1
       ORDER BY tal.performed_at DESC`,
      [taskId]
    );
    return result.rows as TaskActivityLog[];
  }
};
