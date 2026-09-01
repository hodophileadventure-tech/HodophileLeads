import { query } from '../utils/database';
import { sendEmail } from './notifications';

export interface SalaryDeductionInput {
  monthlySalary?: number;
  absentDays?: number;
  lateDays?: number;
  halfDays?: number;
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
  monthlySalary: number;
  dailyRate: number;
  presentDays: number;
  lateDays: number;
  halfDays: number;
  absentDays: number;
  effectiveAbsenceDays: number;
  deductionAmount: number;
  netSalary: number;
}

export function getDailySalaryRate(monthlySalary: number): number {
  const baseSalary = Number(monthlySalary || 0);
  if (!Number.isFinite(baseSalary) || baseSalary <= 0) {
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
  const dailyRate = getDailySalaryRate(monthlySalary);
  const normalized = normalizeAttendancePenalties(input);
  const effectiveAbsenceDays = normalized.absentDays + (normalized.halfDays * 0.5) + (normalized.lateDays * (1 / 6));
  const deductionAmount = Number((effectiveAbsenceDays * dailyRate).toFixed(2));

  return {
    monthlySalary,
    dailyRate,
    absentDays: normalized.absentDays,
    lateDays: normalized.lateDays,
    halfDays: normalized.halfDays,
    effectiveAbsenceDays: Number(effectiveAbsenceDays.toFixed(2)),
    deductionAmount,
    netSalary: Number((monthlySalary - deductionAmount).toFixed(2))
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
    const normalized = normalizeAttendancePenalties({
      absentDays: Number(employee.absent_days || 0),
      lateDays: Number(employee.late_days || 0),
      halfDays: Number(employee.half_days || 0)
    });

    const calculation = calculateMonthlySalaryDeductions({
      monthlySalary: Number(employee.salary || 0),
      absentDays: normalized.absentDays,
      lateDays: normalized.lateDays,
      halfDays: normalized.halfDays
    });

    return {
      employeeId: employee.employee_id,
      employeeName: employee.name,
      email: employee.email,
      roleName: employee.role_name,
      month: normalizedMonth,
      monthlySalary: calculation.monthlySalary,
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
