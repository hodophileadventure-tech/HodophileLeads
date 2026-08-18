import { describe, expect, it } from 'vitest';
import { shouldTriggerFollowUpAlarm } from './followupAlarm';

describe('shouldTriggerFollowUpAlarm', () => {
  it('triggers during the final hour before a follow-up', () => {
    const now = new Date('2026-08-18T10:00:00Z').getTime();
    const dueDate = new Date('2026-08-18T10:30:00Z');

    expect(shouldTriggerFollowUpAlarm(dueDate, now)).toBe(true);
  });

  it('triggers again at the actual follow-up time', () => {
    const now = new Date('2026-08-18T10:30:00Z').getTime();
    const dueDate = new Date('2026-08-18T10:30:00Z');

    expect(shouldTriggerFollowUpAlarm(dueDate, now)).toBe(true);
  });

  it('does not trigger long after the follow-up time has passed', () => {
    const now = new Date('2026-08-18T11:00:00Z').getTime();
    const dueDate = new Date('2026-08-18T10:30:00Z');

    expect(shouldTriggerFollowUpAlarm(dueDate, now)).toBe(false);
  });
});
