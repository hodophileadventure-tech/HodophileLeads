// ============================================================================
// MODEL: Task Comment Management
// ============================================================================

import { query } from '../utils/database';
import type { TaskComment } from '../types/task-management';

export const taskCommentModel = {
  
  async create(data: {
    task_id: string;
    comment_text: string;
    commented_by: string;
    is_system_comment?: boolean;
  }): Promise<TaskComment> {
    const result = await query(
      `INSERT INTO task_comments (
        task_id, comment_text, commented_by, is_system_comment
      ) VALUES ($1, $2, $3, $4)
      RETURNING *`,
      [
        data.task_id,
        data.comment_text,
        data.commented_by,
        data.is_system_comment || false
      ]
    );
    return result.rows[0] as TaskComment;
  },

  async findByTaskId(taskId: string): Promise<TaskComment[]> {
    const result = await query(
      `SELECT tc.*, u.name as commented_by_name
       FROM task_comments tc
       LEFT JOIN users u ON tc.commented_by = u.id
       WHERE tc.task_id = $1
       ORDER BY tc.created_at ASC`,
      [taskId]
    );
    return result.rows as TaskComment[];
  },

  async delete(id: string): Promise<boolean> {
    // Only allow deletion of non-system comments within edit window (1 hour)
    const result = await query(
      `DELETE FROM task_comments 
       WHERE id = $1 
         AND is_system_comment = false
         AND created_at > CURRENT_TIMESTAMP - INTERVAL '1 hour'
       RETURNING id`,
      [id]
    );
    return result.rows.length > 0;
  },

  async addSystemComment(
    taskId: string,
    message: string,
    commentedBy: string,
    details?: Record<string, any>
  ): Promise<TaskComment> {
    return this.create({
      task_id: taskId,
      comment_text: message,
      commented_by: commentedBy,
      is_system_comment: true
    });
  }
};
