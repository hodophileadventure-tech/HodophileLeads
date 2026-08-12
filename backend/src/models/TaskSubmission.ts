// ============================================================================
// MODEL: Task Submission Management
// ============================================================================

import { query } from '../utils/database';
import type { TaskSubmission, ReviewStatus } from '../types/task-management';

export const taskSubmissionModel = {
  
  async create(data: {
    task_id: string;
    submission_notes?: string;
    submitted_by: string;
  }): Promise<TaskSubmission> {
    const result = await query(
      `INSERT INTO task_submissions (
        task_id, submission_notes, submitted_by
      ) VALUES ($1, $2, $3)
      RETURNING *`,
      [data.task_id, data.submission_notes || null, data.submitted_by]
    );
    return result.rows[0] as TaskSubmission;
  },

  async findById(id: string): Promise<TaskSubmission | undefined> {
    const result = await query(
      `SELECT ts.*,
        us.name as submitted_by_name,
        ur.name as reviewer_name
       FROM task_submissions ts
       LEFT JOIN users us ON ts.submitted_by = us.id
       LEFT JOIN users ur ON ts.reviewer_id = ur.id
       WHERE ts.id = $1`,
      [id]
    );
    return result.rows[0] as TaskSubmission | undefined;
  },

  async findByTaskId(
    taskId: string,
    limit?: number
  ): Promise<TaskSubmission[]> {
    let sql = `
      SELECT ts.*,
        us.name as submitted_by_name,
        ur.name as reviewer_name
      FROM task_submissions ts
      LEFT JOIN users us ON ts.submitted_by = us.id
      LEFT JOIN users ur ON ts.reviewer_id = ur.id
      WHERE ts.task_id = $1
      ORDER BY ts.submitted_at DESC
    `;
    const params: any[] = [taskId];

    if (limit) {
      sql += ` LIMIT $2`;
      params.push(limit);
    }

    const result = await query(sql, params);
    return result.rows as TaskSubmission[];
  },

  async updateReviewStatus(
    id: string,
    reviewStatus: ReviewStatus,
    reviewerId: string,
    reviewNotes?: string
  ): Promise<TaskSubmission> {
    const result = await query(
      `UPDATE task_submissions
       SET review_status = $2,
           reviewer_id = $3,
           reviewed_at = CURRENT_TIMESTAMP,
           review_notes = $4,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [id, reviewStatus, reviewerId, reviewNotes || null]
    );

    if (result.rows.length === 0) {
      throw new Error('Submission not found');
    }

    return result.rows[0] as TaskSubmission;
  },

  async getPendingReviews(): Promise<TaskSubmission[]> {
    const result = await query(
      `SELECT ts.*,
        us.name as submitted_by_name,
        t.title as task_title,
        t.assigned_to
       FROM task_submissions ts
       JOIN tasks t ON ts.task_id = t.id
       LEFT JOIN users us ON ts.submitted_by = us.id
       WHERE ts.review_status = 'pending'
       ORDER BY ts.submitted_at ASC`
    );
    return result.rows as TaskSubmission[];
  }
};
