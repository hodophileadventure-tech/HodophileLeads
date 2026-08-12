// ============================================================================
// MODEL: Task Management
// ============================================================================

import { query } from '../utils/database';
import type { Task, TaskStatus } from '../types/task-management';

export const taskModel = {
  
  async create(data: {
    title: string;
    description?: string;
    created_by: string;
    assigned_to: string;
    start_date?: string;
    deadline: string;
    priority: string;
  }): Promise<Task> {
    const result = await query(
      `INSERT INTO tasks (
        title, description, created_by, assigned_to, 
        start_date, deadline, priority
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [
        data.title,
        data.description || null,
        data.created_by,
        data.assigned_to,
        data.start_date || null,
        data.deadline,
        data.priority
      ]
    );
    return result.rows[0] as Task;
  },

  async findById(id: string): Promise<Task | undefined> {
    const result = await query(
      `SELECT t.*, 
        uc.name as created_by_name, uc.email as created_by_email,
        ua.name as assigned_to_name, ua.email as assigned_to_email
       FROM tasks t
       LEFT JOIN users uc ON t.created_by = uc.id
       LEFT JOIN users ua ON t.assigned_to = ua.id
       WHERE t.id = $1`,
      [id]
    );
    return result.rows[0] as Task | undefined;
  },

  async findAll(filters?: {
    status?: TaskStatus;
    priority?: string;
    assigned_to?: string;
    created_by?: string;
    is_overdue?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<Task[]> {
    let sql = `
      SELECT t.*,
        uc.name as created_by_name, uc.email as created_by_email,
        ua.name as assigned_to_name, ua.email as assigned_to_email
      FROM tasks t
      LEFT JOIN users uc ON t.created_by = uc.id
      LEFT JOIN users ua ON t.assigned_to = ua.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (filters?.status) {
      sql += ` AND t.status = $${paramIndex}`;
      params.push(filters.status);
      paramIndex++;
    }
    if (filters?.priority) {
      sql += ` AND t.priority = $${paramIndex}`;
      params.push(filters.priority);
      paramIndex++;
    }
    if (filters?.assigned_to) {
      sql += ` AND t.assigned_to = $${paramIndex}`;
      params.push(filters.assigned_to);
      paramIndex++;
    }
    if (filters?.created_by) {
      sql += ` AND t.created_by = $${paramIndex}`;
      params.push(filters.created_by);
      paramIndex++;
    }
    if (filters?.is_overdue !== undefined) {
      sql += ` AND t.is_overdue = $${paramIndex}`;
      params.push(filters.is_overdue);
      paramIndex++;
    }

    sql += ` ORDER BY t.deadline ASC`;

    if (filters?.limit) {
      sql += ` LIMIT $${paramIndex}`;
      params.push(filters.limit);
      paramIndex++;
    }
    if (filters?.offset) {
      sql += ` OFFSET $${paramIndex}`;
      params.push(filters.offset);
      paramIndex++;
    }

    const result = await query(sql, params);
    return result.rows as Task[];
  },

  async updateStatus(
    id: string,
    newStatus: TaskStatus,
    updatedBy: string
  ): Promise<Task> {
    // Validate transition is valid
    const current = await this.findById(id);
    if (!current) throw new Error('Task not found');

    const validTransitions: Record<TaskStatus, TaskStatus[]> = {
      assigned: ['in_progress', 'cancelled'],
      in_progress: ['submitted', 'cancelled'],
      submitted: ['approved', 'revision_requested', 'cancelled'],
      revision_requested: ['in_progress', 'cancelled'],
      approved: [],
      cancelled: []
    };

    if (!validTransitions[current.status].includes(newStatus)) {
      throw new Error(`Invalid status transition: ${current.status} -> ${newStatus}`);
    }

    const result = await query(
      `UPDATE tasks
       SET status = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [id, newStatus]
    );

    // Log activity
    await query(
      `INSERT INTO task_activity_logs (task_id, action, details, performed_by)
       VALUES ($1, $2, $3, $4)`,
      [
        id,
        'status_changed',
        JSON.stringify({ from_status: current.status, to_status: newStatus }),
        updatedBy
      ]
    );

    return result.rows[0] as Task;
  },

  async update(
    id: string,
    data: {
      title?: string;
      description?: string;
      deadline?: string;
      priority?: string;
      assigned_to?: string;
    }
  ): Promise<Task> {
    const updates: string[] = [];
    const params: any[] = [id];
    let paramIndex = 2;

    if (data.title !== undefined) {
      updates.push(`title = $${paramIndex}`);
      params.push(data.title);
      paramIndex++;
    }
    if (data.description !== undefined) {
      updates.push(`description = $${paramIndex}`);
      params.push(data.description);
      paramIndex++;
    }
    if (data.deadline !== undefined) {
      updates.push(`deadline = $${paramIndex}`);
      params.push(data.deadline);
      paramIndex++;
    }
    if (data.priority !== undefined) {
      updates.push(`priority = $${paramIndex}`);
      params.push(data.priority);
      paramIndex++;
    }
    if (data.assigned_to !== undefined) {
      updates.push(`assigned_to = $${paramIndex}`);
      params.push(data.assigned_to);
      paramIndex++;
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);

    const result = await query(
      `UPDATE tasks
       SET ${updates.join(', ')}
       WHERE id = $1
       RETURNING *`,
      params
    );
    return result.rows[0] as Task;
  },

  async markOverdue(): Promise<number> {
    const result = await query(`
      UPDATE tasks
      SET is_overdue = true
      WHERE deadline < CURRENT_TIMESTAMP
        AND status NOT IN ('approved', 'cancelled')
        AND is_overdue = false
      RETURNING id
    `);
    return result.rowCount || 0;
  },

  async cancel(
    id: string,
    reason: string,
    cancelledBy: string
  ): Promise<Task> {
    const result = await query(
      `UPDATE tasks
       SET status = 'cancelled',
           cancelled_at = CURRENT_TIMESTAMP,
           cancellation_reason = $2,
           cancelled_by = $3,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [id, reason, cancelledBy]
    );

    if (result.rows.length === 0) {
      throw new Error('Task not found');
    }

    return result.rows[0] as Task;
  },

  async delete(id: string): Promise<boolean> {
    // Only delete if in 'assigned' status
    const task = await this.findById(id);
    if (!task) throw new Error('Task not found');
    if (task.status !== 'assigned') {
      throw new Error('Can only delete tasks in assigned status');
    }

    const result = await query(
      'DELETE FROM tasks WHERE id = $1 RETURNING id',
      [id]
    );
    return result.rows.length > 0;
  }
};
