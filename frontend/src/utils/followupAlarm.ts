export const shouldTriggerFollowUpAlarm = (dueDate: Date | string, now: number): boolean => {
  const dueAt = new Date(dueDate).getTime();
  if (!Number.isFinite(dueAt)) return false;

  const diffMs = dueAt - now;
  const oneHourMs = 60 * 60 * 1000;

  return diffMs >= 0 && diffMs <= oneHourMs;
};
