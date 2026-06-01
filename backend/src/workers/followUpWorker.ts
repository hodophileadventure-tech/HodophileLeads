import cron from 'node-cron';
import { query } from '../utils/database';
import { sendEmail, sendWhatsApp, sendSMS } from '../services/notifications';
import { notificationsModel } from '../models/Notification';
import { sendToUser } from '../utils/wsServer';

export const startFollowUpWorker = () => {
  // Run every minute for demo/dev. In prod adjust schedule.
  cron.schedule('* * * * *', async () => {
    try {
      console.log('[Worker] Checking for overdue follow-ups...');
      const res = await query("SELECT * FROM follow_ups WHERE status != 'completed' AND due_date < now()", []);
      const items = res.rows || [];
      for (const item of items) {
        try {
          console.log('[Worker] Overdue follow-up:', item.id || item);
          // Placeholder notifications
          const message = `Follow-up overdue for lead ${item.lead_id} - task ${item.title || item.task_type || 'Follow up'}`;
          // create in-app notification for assignee
          try {
            const created = await notificationsModel.create({
              userId: item.assigned_to,
              leadId: item.lead_id,
              type: 'followup_overdue',
              message,
              payload: { followUpId: item.id }
            });
            // emit realtime
            try {
              sendToUser(String(item.assigned_to), 'notification', created);
            } catch (e) {
              // ignore
            }
          } catch (nerr) {
            console.error('[Worker] Failed to create in-app notification', nerr);
          }
          if (item.whatsapp_number) {
            await sendWhatsApp(item.whatsapp_number, message);
          }
          if (item.assigned_to_email) {
            await sendEmail(item.assigned_to_email, 'Overdue Follow-up', message);
          }
          if (item.assigned_to_phone) {
            await sendSMS(item.assigned_to_phone, message);
          }
        } catch (inner) {
          console.error('[Worker] Failed to notify for follow-up', item.id, inner);
        }
      }
    } catch (err) {
      console.error('[Worker] Error fetching overdue follow-ups', err);
    }
  });
};
