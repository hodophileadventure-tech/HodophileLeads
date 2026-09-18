import { describe, expect, it } from 'vitest';
import { formatKarachiDateTime, toKarachiDateTimeInputValue } from './helpers';

import { parseKarachiDateTimeToISOString } from './helpers';

describe('Karachi task deadlines', () => {
  it('formats UTC task deadlines in Karachi time', () => {
    const formatted = formatKarachiDateTime('2026-09-18T15:00:00.000Z');
    expect(formatted).toContain('2026');
    expect(formatted).toContain('8:00');
    expect(formatted).toMatch(/PM|AM/);
  });

  it('converts Karachi local datetime strings into the correct UTC value for storage', () => {
    expect(parseKarachiDateTimeToISOString('2026-09-18T15:12')).toBe('2026-09-18T10:12:00.000Z');
  });

  it('converts task deadlines to a Karachi datetime-local input value', () => {
    expect(toKarachiDateTimeInputValue('2026-09-18T15:00:00.000Z')).toBe('2026-09-18T20:00');
  });
});
