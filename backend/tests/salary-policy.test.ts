import {
  calculateMonthlySalaryDeductions,
  normalizeAttendancePenalties,
  getDailySalaryRate
} from '../src/services/salary-policy';

describe('salary policy', () => {
  it('uses a daily rate of Rs. 1000 for a Rs. 30,000 salary month', () => {
    expect(getDailySalaryRate(30000)).toBe(1000);
  });

  it('deducts a full day when an employee is absent', () => {
    const result = calculateMonthlySalaryDeductions({
      monthlySalary: 30000,
      absentDays: 1,
      lateDays: 0,
      halfDays: 0
    });

    expect(result.deductionAmount).toBe(1000);
    expect(result.netSalary).toBe(29000);
    expect(result.effectiveAbsenceDays).toBe(1);
  });

  it('normalizes 3 late marks as half-day equivalent and 2 half-days as an absent day', () => {
    const fromLate = normalizeAttendancePenalties({ absentDays: 0, lateDays: 3, halfDays: 0 });
    const fromLateAndHalf = normalizeAttendancePenalties({ absentDays: 0, lateDays: 3, halfDays: 1 });
    const twoHalfDays = normalizeAttendancePenalties({ absentDays: 0, lateDays: 0, halfDays: 2 });

    expect(fromLate).toEqual({ absentDays: 0, lateDays: 0, halfDays: 1 });
    expect(twoHalfDays).toEqual({ absentDays: 1, lateDays: 0, halfDays: 0 });
    expect(fromLateAndHalf).toEqual({ absentDays: 1, lateDays: 0, halfDays: 0 });
  });

  it('converts normalized penalties into a month-end salary deduction', () => {
    const result = calculateMonthlySalaryDeductions({
      monthlySalary: 30000,
      absentDays: 0,
      lateDays: 3,
      halfDays: 1
    });

    expect(result.deductionAmount).toBe(1000);
    expect(result.netSalary).toBe(29000);
    expect(result.effectiveAbsenceDays).toBe(1);
  });
});
