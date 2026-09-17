import { describe, expect, it } from 'vitest';
import { getAssignableUsers, getTaskStatusLabel } from './task-assignment';

describe('task assignment helpers', () => {
  it('keeps all active users assignable for admin work', () => {
    const users = [
      { id: 'admin-1', name: 'Areeba', is_active: true, role_slug: 'admin' },
      { id: 'agent-1', name: 'Usman', is_active: true, role_slug: 'agent' },
      { id: 'agent-2', name: 'Sara', is_active: true, role_slug: 'content_creator' },
      { id: 'inactive-1', name: 'Old User', is_active: false, role_slug: 'agent' }
    ] as any;

    expect(getAssignableUsers(users).map((user) => user.id)).toEqual([
      'admin-1',
      'agent-2',
      'agent-1'
    ]);
  });

  it('maps task statuses to the sheet-friendly labels', () => {
    expect(getTaskStatusLabel('assigned')).toBe('Pending');
    expect(getTaskStatusLabel('in_progress')).toBe('In progress');
    expect(getTaskStatusLabel('submitted')).toBe('Completed');
    expect(getTaskStatusLabel('revision_requested')).toBe('Not complete');
  });
});
