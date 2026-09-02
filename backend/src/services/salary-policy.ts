import { query } from '../utils/database';
import { sendEmail } from './notifications';

export interface SalaryDeductionInput {
  monthlySalary?: number;
  absentDays?: number;
  lateDays?: number;
  halfDays?: number;
  markedDays?: number;
}

export interface NormalizedAttendancePenalty {
  absentDays: number;
  lateDays: number;
  halfDays: number;
}

export interface SalaryDeductionResult {
  monthlySalary: number;
  dailyRate: number;
  absentDays: number;
  lateDays: number;
  halfDays: number;
  effectiveAbsenceDays: number;
  deductionAmount: number;
  netSalary: number;
}

export interface SalarySlipSummary {
  employeeId: string;
  employeeName: string;
  email: string;
  roleName?: string;
  month: string;
  originalMonthlySalary: number;
  monthlySalary: number;
  payableSalary: number;
  dailyRate: number;
  presentDays: number;
  lateDays: number;
  halfDays: number;
  absentDays: number;
  effectiveAbsenceDays: number;
  deductionAmount: number;
  netSalary: number;
}

export function getDailySalaryRate(monthlySalary: number, markedDays = 30): number {
  const baseSalary = Number(monthlySalary || 0);
  const eligibleDays = Number(markedDays || 0);
  if (!Number.isFinite(baseSalary) || baseSalary <= 0 || !Number.isFinite(eligibleDays) || eligibleDays <= 0) {
    return 0;
  }

  return Number((baseSalary / 30).toFixed(2));
}

export function normalizeAttendancePenalties(input: Partial<SalaryDeductionInput>): NormalizedAttendancePenalty {
  let absentDays = Number(input.absentDays || 0);
  let lateDays = Number(input.lateDays || 0);
  let halfDays = Number(input.halfDays || 0);

  while (lateDays >= 3) {
    lateDays -= 3;
    halfDays += 1;
  }

  while (halfDays >= 2) {
    halfDays -= 2;
    absentDays += 1;
  }

  while (lateDays >= 3 && halfDays >= 1) {
    lateDays -= 3;
    halfDays -= 1;
    absentDays += 1;
  }

  return {
    absentDays,
    lateDays,
    halfDays
  };
}

export function calculateMonthlySalaryDeductions(input: SalaryDeductionInput): SalaryDeductionResult {
  const monthlySalary = Number(input.monthlySalary || 0);
  const normalized = normalizeAttendancePenalties(input);
  const markedDays = input.markedDays === undefined ? 30 : Number(input.markedDays || 0);
  const salaryBase = markedDays > 0 ? Number((monthlySalary * (markedDays / 30)).toFixed(2)) : 0;
  const dailyRate = markedDays > 0 ? Number((salaryBase / markedDays).toFixed(2)) : 0;
  // Only count days with attendance entered. Blank/unmarked days are excluded from both salary and deductions.
  const effectiveAbsenceDays = normalized.absentDays + (normalized.halfDays * 0.5);
  const deductionAmount = Number((effectiveAbsenceDays * dailyRate).toFixed(2));

  return {
    monthlySalary: salaryBase,
    dailyRate,
    absentDays: normalized.absentDays,
    lateDays: normalized.lateDays,
    halfDays: normalized.halfDays,
    effectiveAbsenceDays: Number(effectiveAbsenceDays.toFixed(2)),
    deductionAmount,
    netSalary: Number((salaryBase - deductionAmount).toFixed(2))
  };
}

export async function generateMonthlySalaryReport(month: string, sendEmails = true) {
  const normalizedMonth = /^\d{4}-\d{2}$/.test(String(month || '')) ? String(month) : new Date().toISOString().slice(0, 7);
  const monthStart = `${normalizedMonth}-01`;

  const result = await query(
    `SELECT u.id AS employee_id, u.name, u.email, u.salary,
            COALESCE(r.name, u.role, 'Employee') AS role_name,
            COUNT(a.id) FILTER (WHERE a.status = 'present')::int AS present_days,
            COUNT(a.id) FILTER (WHERE a.status = 'late')::int AS late_days,
            COUNT(a.id) FILTER (WHERE a.status = 'absent')::int AS absent_days,
            COUNT(a.id) FILTER (WHERE a.status = 'half_day')::int AS half_days,
            COUNT(a.id)::int AS marked_days
     FROM users u
     LEFT JOIN roles r ON r.id = u.role_id
     LEFT JOIN attendance a ON a.user_id = u.id
       AND a.attendance_date >= $1::date
       AND a.attendance_date < ($1::date + INTERVAL '1 month')
     WHERE COALESCE(r.slug, u.role, '') <> 'admin'
       AND u.attendance_exempt = FALSE
     GROUP BY u.id, u.name, u.email, u.salary, r.name, u.role
     ORDER BY u.name ASC`,
    [monthStart]
  );

  const slips: SalarySlipSummary[] = result.rows.map((employee: any) => {
    const markedDays = Number(employee.marked_days || 0);
    const originalMonthlySalary = Number(employee.salary || 0);
    const normalized = normalizeAttendancePenalties({
      absentDays: Number(employee.absent_days || 0),
      lateDays: Number(employee.late_days || 0),
      halfDays: Number(employee.half_days || 0)
    });

    const calculation = calculateMonthlySalaryDeductions({
      monthlySalary: originalMonthlySalary,
      absentDays: normalized.absentDays,
      lateDays: normalized.lateDays,
      halfDays: normalized.halfDays,
      markedDays
    });

    return {
      employeeId: employee.employee_id,
      employeeName: employee.name,
      email: employee.email,
      roleName: employee.role_name,
      month: normalizedMonth,
      originalMonthlySalary,
      monthlySalary: calculation.monthlySalary,
      payableSalary: calculation.monthlySalary,
      dailyRate: calculation.dailyRate,
      presentDays: Number(employee.present_days || 0),
      lateDays: calculation.lateDays,
      halfDays: calculation.halfDays,
      absentDays: calculation.absentDays,
      effectiveAbsenceDays: calculation.effectiveAbsenceDays,
      deductionAmount: calculation.deductionAmount,
      netSalary: calculation.netSalary
    };
  });

  const adminRecipients = await query(
    `SELECT DISTINCT u.name, u.email
     FROM users u
     LEFT JOIN roles r ON r.id = u.role_id
     WHERE COALESCE(r.slug, u.role, '') IN ('admin', 'qa', 'quality_assurance')
       AND u.email IS NOT NULL`
  );

  if (sendEmails) {
    for (const admin of adminRecipients.rows) {
      const subject = `Monthly salary slip report - ${normalizedMonth}`;
      const body = slips.map((slip) => (
        `${slip.employeeName}: salary ${slip.monthlySalary.toLocaleString()} | deduction ${slip.deductionAmount.toLocaleString()} | net ${slip.netSalary.toLocaleString()} | present ${slip.presentDays} | late ${slip.lateDays} | half-day ${slip.halfDays} | absent ${slip.absentDays}`
      )).join('\n');

      await sendEmail(
        admin.email,
        subject,
        `Monthly salary slip summary for ${normalizedMonth}\n\n${body || 'No payroll entries found.'}`
      );
    }
  }

  return { month: normalizedMonth, slips, adminRecipients: adminRecipients.rows }; 
}
