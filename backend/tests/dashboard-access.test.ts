import { canAccessAdminLikeAnalytics, canAccessOwnAnalytics, getLeadScopeAgentId } from '../src/controllers/dashboard-controller';

describe('dashboard access helpers', () => {
  it('allows admins and managers to view admin-style analytics, while agents stay self-scoped', () => {
    expect(canAccessAdminLikeAnalytics('admin')).toBe(true);
    expect(canAccessAdminLikeAnalytics('manager')).toBe(true);
    expect(canAccessAdminLikeAnalytics('agent')).toBe(false);
    expect(canAccessOwnAnalytics('agent')).toBe(true);
  });

  it('scopes dashboard stats to the current agent for agent role only', () => {
    expect(getLeadScopeAgentId('agent', 'agent-1')).toBe('agent-1');
    expect(getLeadScopeAgentId('manager', 'agent-1')).toBeUndefined();
    expect(getLeadScopeAgentId('admin', 'agent-1')).toBeUndefined();
  });
});
