// ============================================================================
// WORKER: Task Overdue Detection
// ============================================================================

import { taskModel } from '../models/Task';
import { notificationModel } from '../models/Notification';
import { query } from '../utils/database';

export const startTaskOverdueWorker = () => {
  console.log('[Worker] Starting task overdue detection worker...');

  // Run every 5 minutes
  const intervalId = setInterval(async () => {
    try {
      // Mark overdue tasks
      const overdueCount = await taskModel.markOverdue();

      if (overdueCount > 0) {
        console.log(`[Worker] Marked ${overdueCount} tasks as overdue`);

        // Send notifications for newly overdue tasks
        const overdueNotifications = await query(`
          SELECT t.id, t.assigned_to, t.title
          FROM tasks t
          WHERE t.is_overdue = true
            AND t.status NOT IN ('approved', 'cancelled')
            AND NOT EXISTS (
              SELECT 1 FROM notifications n
              WHERE n.entity_type = 'task'
                AND n.entity_id = t.id
                AND n.type = 'task_overdue'
                AND n.created_at > t.deadline
            )
          LIMIT 50
        `);

        for (const task of overdueNotifications.rows) {
          await notificationModel.create({
            user_id: task.assigned_to,
            entity_type: 'task',
            entity_id: task.id,
            type: 'task_overdue',
            message: `Task "${task.title}" is now overdue`,
            payload: { task_id: task.id }
          });

          console.log(
            `[Worker] Sent overdue notification for task: ${task.title}`
          );
        }
      }
    } catch (error) {
      console.error('[Worker] Task overdue worker error:', error);
    }
  }, 5 * 60 * 1000); // Every 5 minutes

  // Allow graceful shutdown
  return () => clearInterval(intervalId);
};
