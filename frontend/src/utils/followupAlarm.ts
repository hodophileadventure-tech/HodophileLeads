export const FOLLOW_UP_ALARM_SNOOZE_MS = 15 * 60 * 1000;

export const shouldTriggerFollowUpAlarm = (
  dueDate: Date | string,
  now: number,
  snoozedUntil = 0
): boolean => {
  const dueAt = new Date(dueDate).getTime();
  if (!Number.isFinite(dueAt)) return false;
  if (snoozedUntil > now) return false;

  const diffMs = dueAt - now;
  const oneHourMs = 60 * 60 * 1000;

  return diffMs <= oneHourMs;
};
