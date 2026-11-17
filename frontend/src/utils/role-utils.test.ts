import { describe, expect, it } from 'vitest';
import { isCreativeRole, normalizeRoleSlug } from './role-utils';

describe('creative role detection', () => {
  it('recognizes creative role names and slug variants', () => {
    expect(isCreativeRole('Graphic Designer')).toBe(true);
    expect(isCreativeRole('graphic-designer')).toBe(true);
    expect(isCreativeRole('video_editor')).toBe(true);
    expect(isCreativeRole('content-creator')).toBe(true);
  });

  it('does not classify sales roles as creative', () => {
    expect(isCreativeRole('agent')).toBe(false);
    expect(isCreativeRole('Sales Executive')).toBe(false);
    expect(isCreativeRole('Quality Assurance')).toBe(false);
    expect(isCreativeRole('Software Engineer')).toBe(false);
    expect(normalizeRoleSlug('  Sales Executive  ')).toBe('sales_executive');
  });
});
