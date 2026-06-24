import type { FollowUp, FollowUpPriority } from '../types';

const normalizeFollowUpStatus = (status: unknown): FollowUp['status'] => {
  const raw = String(status || '').trim().toLowerCase();
  if (raw === 'overdue' || raw === 'today' || raw === 'upcoming' || raw === 'completed' || raw === 'canceled') {
    return raw as FollowUp['status'];
  }
  if (raw === 'pending' || raw === 'scheduled') {
    return 'upcoming';
  }
  return 'upcoming';
};

export const normalizeFollowUp = (item: any): FollowUp => ({
  id: String(item.id || item._id || ''),
  leadId: String(item.leadId || item.lead_id || ''),
  type: item.type || item.task_type || item.reminder_type || 'manual',
  reminderType: item.reminderType || item.reminder_type,
  title: item.title || item.task_type || 'Follow up',
  description: item.description || item.notes || '',
  dueDate: item.dueDate || item.due_date || item.due || new Date().toISOString(),
  status: normalizeFollowUpStatus(item.status || item.task_status),
  priority: (item.priority || 'medium') as FollowUpPriority,
  assignedTo: String(item.assignedTo || item.assigned_to || ''),
  whatsappNumber: item.whatsappNumber || item.whatsapp_number,
  whatsappLink: item.whatsappLink || item.whatsapp_link,
  completedAt: item.completedAt || item.completed_at || null,
  canceledReason: item.canceledReason || item.canceled_reason || null,
  canceledBy: item.canceledBy || item.canceled_by || null,
  canceledAt: item.canceledAt || item.canceled_at || null,
  createdAt: item.createdAt || item.created_at || new Date().toISOString(),
  clientName: item.clientName || item.client_name || null,
  phone: item.phone || null
});
