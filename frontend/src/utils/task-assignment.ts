export type AssignableUser = {
  id: string;
  name: string;
  role_slug?: string;
  role_name?: string;
  is_active?: boolean;
};

export const getAssignableUsers = (users: AssignableUser[]) =>
  (users || [])
    .filter((user) => user && String(user.id || '').trim() && user.is_active !== false)
    .sort((a, b) => {
      const aIsAdmin = String(a.role_slug || a.role_name || '').toLowerCase() === 'admin';
      const bIsAdmin = String(b.role_slug || b.role_name || '').toLowerCase() === 'admin';

      if (aIsAdmin !== bIsAdmin) {
        return Number(bIsAdmin) - Number(aIsAdmin);
      }

      return (a.name || '').localeCompare(b.name || '');
    });

export const getTaskStatusLabel = (status?: string) => {
  switch (status) {
    case 'assigned':
      return 'Pending';
    case 'in_progress':
      return 'In progress';
    case 'submitted':
      return 'Completed';
    case 'revision_requested':
      return 'Not complete';
    case 'approved':
      return 'Approved';
    case 'cancelled':
      return 'Cancelled';
    default:
      return 'Pending';
  }
};

export const isTaskComplete = (status?: string) => ['submitted', 'approved'].includes(String(status || ''));
