// ============================================================================
// WORKER: Task Overdue Detection
// ============================================================================

import { taskModel } from '../models/Task';
import { notificationsModel } from '../models/Notification';
import { query } from '../utils/database';
import { sendToUser } from '../utils/wsServer';

const TASK_DEADLINE_ALERT_MINUTES = Number(process.env.TASK_DEADLINE_ALERT_MINUTES || 30);

const formatDeadline = (deadline: Date) => deadline.toLocaleString('en-GB', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: process.env.ATTENDANCE_TIMEZONE || 'Asia/Karachi'
});

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
          await notificationsModel.create({
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

      const upcomingDeadlineNotifications = await query(`
        SELECT t.id, t.created_by, t.assigned_to, t.title, t.deadline,
               assignee.name AS assigned_to_name
        FROM tasks t
        LEFT JOIN users assignee ON assignee.id = t.assigned_to
        WHERE t.deadline > CURRENT_TIMESTAMP
          AND t.deadline <= CURRENT_TIMESTAMP + ($1::int * INTERVAL '1 minute')
          AND t.status IN ('assigned', 'in_progress', 'revision_requested')
          AND t.created_by IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM notifications n
            WHERE n.entity_type = 'task'
              AND n.entity_id = t.id
              AND n.type = 'task_deadline_soon'
          )
        ORDER BY t.deadline ASC
        LIMIT 50
      `, [TASK_DEADLINE_ALERT_MINUTES]);

      for (const task of upcomingDeadlineNotifications.rows) {
        const deadlineLabel = formatDeadline(new Date(task.deadline));
        const notification = await notificationsModel.create({
          user_id: task.created_by,
          entity_type: 'task',
          entity_id: task.id,
          type: 'task_deadline_soon',
          message: `Task deadline approaching: "${task.title}" assigned to ${task.assigned_to_name || 'team member'} is due ${deadlineLabel}`,
          payload: {
            task_id: task.id,
            task_title: task.title,
            assigned_to_name: task.assigned_to_name || 'team member',
            deadline: task.deadline,
            deadline_label: deadlineLabel
          }
        });
        sendToUser(String(task.created_by), 'notification', notification);
        console.log(`[Worker] Sent upcoming deadline notification for task: ${task.title}`);
      }
    } catch (error) {
      console.error('[Worker] Task overdue worker error:', error);
    }
  }, 60 * 1000); // Check every minute so the alert window is precise

  // Allow graceful shutdown
  return () => clearInterval(intervalId);
};
