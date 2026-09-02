import { useEffect, useState } from 'react';
import axios from 'axios';
import { jsPDF } from 'jspdf';

const RAW_API_BASE = (import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? 'http://localhost:5000' : '')).replace(/\/$/, '');
const API_BASE = RAW_API_BASE.replace(/\/api\/?$/, '');
const API_PREFIX = API_BASE ? `${API_BASE}/api` : '/api';

type AttendanceStatus = 'present' | 'late' | 'absent' | 'half_day';
type Employee = { user_id: string; name: string; email: string; role_name?: string; status?: AttendanceStatus; note?: string };
type MonthlyEmployee = Omit<Employee, 'status' | 'note'> & { marked_days: number; present: number; late: number; absent: number; half_day: number; days: Record<string, AttendanceStatus> };
const statusLabels: Record<AttendanceStatus, string> = { present: 'Present', late: 'Late', absent: 'Absent', half_day: 'Half Day' };
const statusShortLabels: Record<AttendanceStatus, string> = { present: 'P', late: 'L', absent: 'A', half_day: 'H' };

const today = () => new Date().toLocaleDateString('en-CA');
const authConfig = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });

const daysInMonth = (value: string) => {
  const [year, monthNumber] = value.split('-').map(Number);
  return new Date(year, monthNumber, 0).getDate();
};

const dayInfo = (value: string, day: number) => {
  const date = new Date(`${value}-${String(day).padStart(2, '0')}T12:00:00`);
  return { number: day, name: date.toLocaleDateString('en-US', { weekday: 'short' }), weekend: date.getDay() === 0 || date.getDay() === 6 };
};

export default function AttendancePage() {
  const [date, setDate] = useState(today);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [month, setMonth] = useState(date.slice(0, 7));
  const [monthlyEmployees, setMonthlyEmployees] = useState<MonthlyEmployee[]>([]);
  const [monthlyLoading, setMonthlyLoading] = useState(false);
  const [locked, setLocked] = useState(false);
  const [salarySlips, setSalarySlips] = useState<Array<{
    employeeId: string;
    employeeName: string;
    email: string;
    roleName?: string;
    month: string;
    originalMonthlySalary?: number;
    monthlySalary: number;
    payableSalary?: number;
    dailyRate: number;
    presentDays: number;
    lateDays: number;
    halfDays: number;
    absentDays: number;
    effectiveAbsenceDays: number;
    deductionAmount: number;
    netSalary: number;
  }>>([]);
  const [salaryLoading, setSalaryLoading] = useState(false);
  const [salaryMessage, setSalaryMessage] = useState('');
  const [salaryError, setSalaryError] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true); setError(''); setMessage('');
      try {
        const response = await axios.get(`${API_PREFIX}/admin/attendance?date=${date}`, authConfig());
        setEmployees(response.data.employees || []);
        setLocked(Boolean(response.data.locked));
      } catch (err: any) {
        setError(err.response?.data?.error || 'Failed to load attendance');
      } finally { setLoading(false); }
    };
    void load();
  }, [date]);

  useEffect(() => {
    const loadMonthly = async () => {
      setMonthlyLoading(true);
      try {
        const response = await axios.get(`${API_PREFIX}/admin/attendance/monthly?month=${month}`, authConfig());
        setMonthlyEmployees(response.data.employees || []);
      } catch (err: any) {
        setError(err.response?.data?.error || 'Failed to load monthly report');
      } finally { setMonthlyLoading(false); }
    };
    void loadMonthly();
  }, [month]);

  const updateEmployee = (userId: string, changes: Partial<Employee>) => {
    if (!locked) setEmployees(current => current.map(employee => employee.user_id === userId ? { ...employee, ...changes } : employee));
  };

  const save = async () => {
    if (!window.confirm('Save and lock this attendance sheet for this date? This action cannot be undone from the UI.')) {
      return;
    }

    setSaving(true); setError(''); setMessage('');
    try {
      await axios.put(`${API_PREFIX}/admin/attendance`, {
        date,
        lock: true,
        records: employees.map(employee => ({ userId: employee.user_id, status: employee.status || 'absent', note: employee.note || '' }))
      }, authConfig());
      setLocked(true);
      setMessage('Attendance saved and locked successfully.');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save attendance');
    } finally { setSaving(false); }
  };

  const counts = employees.reduce((result, employee) => { const status = employee.status || 'unmarked'; result[status] = (result[status] || 0) + 1; return result; }, {} as Record<string, number>);
  const monthDays = Array.from({ length: daysInMonth(month) }, (_, index) => dayInfo(month, index + 1));
  const monthlyTotals = monthlyEmployees.reduce((result, employee) => ({
    present: result.present + employee.present,
    absent: result.absent + employee.absent,
    late: result.late + employee.late,
    half_day: result.half_day + employee.half_day,
  }), { present: 0, absent: 0, late: 0, half_day: 0 });

  const generateSalarySlips = async () => {
    setSalaryLoading(true);
    setSalaryError('');
    setSalaryMessage('');
    try {
      const response = await axios.post(`${API_PREFIX}/admin/attendance/salary-slips`, { month }, authConfig());
      const slips = response.data.slips || [];
      setSalarySlips(slips);
      setSalaryMessage(`Generated ${slips.length} salary slip${slips.length === 1 ? '' : 's'} for ${month}.`);
    } catch (err: any) {
      setSalaryError(err.response?.data?.error || 'Failed to generate salary slips');
      setSalarySlips([]);
    } finally {
      setSalaryLoading(false);
    }
  };

  const downloadSalarySlips = () => {
    if (!salarySlips.length) return;

    const headers = ['Employee Name', 'Email', 'Role', 'Month', 'Original Monthly Salary', 'Payable Salary', 'Deduction Amount', 'Net Salary', 'Present Days', 'Late Days', 'Half Days', 'Absent Days'];
    const rows = salarySlips.map((slip) => [
      slip.employeeName,
      slip.email,
      slip.roleName || 'Employee',
      slip.month,
      Number(slip.originalMonthlySalary ?? 0),
      Number(slip.payableSalary ?? slip.monthlySalary ?? 0),
      Number(slip.deductionAmount || 0),
      Number(slip.netSalary || 0),
      Number(slip.presentDays || 0),
      Number(slip.lateDays || 0),
      Number(slip.halfDays || 0),
      Number(slip.absentDays || 0),
    ]);

    const csvContent = [headers, ...rows]
      .map((values) => values.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `salary-slips-${month}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const downloadSingleSalarySlip = (slip: {
    employeeName: string;
    email: string;
    roleName?: string;
    month: string;
    originalMonthlySalary?: number;
    monthlySalary: number;
    payableSalary?: number;
    dailyRate?: number;
    deductionAmount: number;
    netSalary: number;
    presentDays: number;
    lateDays: number;
    halfDays: number;
    absentDays: number;
    effectiveAbsenceDays?: number;
  }) => {
    const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 40;

    pdf.setFillColor(16, 185, 129);
    pdf.rect(0, 0, pageWidth, 80, 'F');

    pdf.setTextColor(255, 255, 255);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(22);
    pdf.text('Salary Slip', margin, 42);

    pdf.setFontSize(10);
    pdf.text(`Month: ${slip.month}`, pageWidth - 170, 42);

    pdf.setDrawColor(220, 220, 220);
    pdf.setTextColor(15, 23, 42);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    pdf.text('Employee Details', margin, 110);

    const leftX = margin;
    const rightX = pageWidth / 2 + 10;
    let y = 135;
    const detailRows = [
      ['Employee', slip.employeeName],
      ['Email', slip.email],
      ['Role', slip.roleName || 'Employee'],
      ['Original Salary', `PKR ${Number(slip.originalMonthlySalary ?? 0).toLocaleString('en-PK')}`],
      ['Payable Salary', `PKR ${Number(slip.payableSalary ?? slip.monthlySalary ?? 0).toLocaleString('en-PK')}`],
      ['Daily Rate', `PKR ${Number(slip.dailyRate || 0).toLocaleString('en-PK')}`],
    ];

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    detailRows.forEach(([label, value]) => {
      pdf.setTextColor(71, 85, 105);
      pdf.text(String(label), leftX, y);
      pdf.setTextColor(15, 23, 42);
      pdf.text(String(value), rightX, y, { maxWidth: rightX - leftX - 10 });
      y += 18;
    });

    y += 10;
    pdf.setFont('helvetica', 'bold');
    pdf.text('Attendance Summary', margin, y);
    y += 18;
    pdf.setFont('helvetica', 'normal');

    const summaryRows = [
      ['Present Days', String(slip.presentDays)],
      ['Late Days', String(slip.lateDays)],
      ['Half Days', String(slip.halfDays)],
      ['Absent Days', String(slip.absentDays)],
      ['Effective Absence Days', String(slip.effectiveAbsenceDays ?? 0)],
    ];

    summaryRows.forEach(([label, value]) => {
      pdf.setTextColor(71, 85, 105);
      pdf.text(String(label), leftX, y);
      pdf.setTextColor(15, 23, 42);
      pdf.text(String(value), rightX, y);
      y += 18;
    });

    y += 16;
    pdf.setDrawColor(16, 185, 129);
    pdf.line(margin, y, pageWidth - margin, y);
    y += 22;

    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(15, 23, 42);
    pdf.text('Total Deduction', margin, y);
    pdf.text(`PKR ${Number(slip.deductionAmount || 0).toLocaleString('en-PK')}`, rightX, y);
    y += 22;
    pdf.setTextColor(22, 101, 52);
    pdf.text('Net Salary', margin, y);
    pdf.text(`PKR ${Number(slip.netSalary || 0).toLocaleString('en-PK')}`, rightX, y);

    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(100, 116, 139);
    pdf.text('Generated by TRIPNEXUS Admin Payroll', margin, pageHeight - 30);

    pdf.save(`salary-slip-${slip.employeeName.toLowerCase().replace(/\s+/g, '-')}-${slip.month}.pdf`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900">Employee Attendance</h1><p className="mt-1 text-gray-600">Mark attendance for your team by date.</p></div>
        <div className="flex items-end gap-3"><label className="text-sm font-medium text-gray-700">Date<input type="date" value={date} onChange={event => setDate(event.target.value)} className="mt-1 block rounded border border-gray-300 px-3 py-2" /></label><button onClick={save} disabled={locked || saving || loading || employees.length === 0} className="rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50">{locked ? 'Sheet Locked' : saving ? 'Saving...' : 'Save & Lock'}</button></div>
      </div>
      {(message || error || salaryMessage || salaryError) && <div className={`rounded border p-3 ${salaryError || error ? 'border-red-200 bg-red-50 text-red-700' : 'border-green-200 bg-green-50 text-green-700'}`}>{salaryError || error || salaryMessage || message}</div>}
      {locked && !error && <div className="rounded border border-amber-200 bg-amber-50 p-3 text-amber-800">This date has been saved and locked. Attendance cannot be changed.</div>}
      <div className="flex flex-wrap gap-3 text-sm"><span className="rounded bg-gray-100 px-3 py-1">Total: {employees.length}</span><span className="rounded bg-green-100 px-3 py-1 text-green-800">Present: {counts.present || 0}</span><span className="rounded bg-yellow-100 px-3 py-1 text-yellow-800">Late: {counts.late || 0}</span><span className="rounded bg-red-100 px-3 py-1 text-red-800">Absent: {counts.absent || 0}</span><span className="rounded bg-orange-100 px-3 py-1 text-orange-800">Half Day: {counts.half_day || 0}</span></div>
      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white"><table className="w-full"><thead className="bg-gray-50"><tr><th className="px-5 py-3 text-left text-sm font-semibold">Employee</th><th className="px-5 py-3 text-left text-sm font-semibold">Role</th><th className="px-5 py-3 text-left text-sm font-semibold">Status</th><th className="px-5 py-3 text-left text-sm font-semibold">Note</th></tr></thead><tbody className="divide-y divide-gray-200">{loading ? <tr><td colSpan={4} className="p-6 text-center text-gray-500">Loading employees...</td></tr> : employees.length === 0 ? <tr><td colSpan={4} className="p-6 text-center text-gray-500">No employees found.</td></tr> : employees.map(employee => <tr key={employee.user_id}><td className="px-5 py-3"><div className="font-medium text-gray-900">{employee.name}</div><div className="text-xs text-gray-500">{employee.email}</div></td><td className="px-5 py-3 text-sm text-gray-600">{employee.role_name || 'Employee'}</td><td className="px-5 py-3"><select disabled={locked} value={employee.status || ''} onChange={event => updateEmployee(employee.user_id, { status: event.target.value as AttendanceStatus })} className="rounded border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100"><option value="">Select status</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></td><td className="px-5 py-3"><input disabled={locked} value={employee.note || ''} onChange={event => updateEmployee(employee.user_id, { note: event.target.value })} placeholder="Optional note" className="w-full min-w-48 rounded border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100" /></td></tr>)}</tbody></table></div>
      <section className="overflow-hidden border-2 border-sky-700 bg-white shadow-sm">
        <div className="flex flex-col gap-3 bg-gradient-to-r from-sky-500 to-cyan-400 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div><h2 className="text-2xl font-black tracking-tight text-blue-950">Attendance Sheet</h2><p className="text-sm font-medium text-blue-950/80">Daily attendance register</p></div>
          <div className="flex items-center gap-3">
            <label className="text-sm font-bold text-blue-950">Month<input type="month" value={month} onChange={event => setMonth(event.target.value)} className="ml-2 rounded border border-blue-900/30 bg-white px-2 py-1 font-semibold" /></label>
            <button onClick={generateSalarySlips} disabled={salaryLoading} className="rounded bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">{salaryLoading ? 'Generating...' : 'Salary Slip'}</button>
            <button onClick={downloadSalarySlips} disabled={!salarySlips.length} className="rounded bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-900 disabled:opacity-50">Download CSV</button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-300 bg-slate-50 px-3 py-2 text-xs font-bold uppercase tracking-wide">
          <span className="text-slate-600">Legend:</span><span className="text-green-700">P Present</span><span className="text-red-700">A Absent</span><span className="text-amber-700">L Late</span><span className="text-orange-700">H Half day</span>
          <span className="ml-auto text-slate-500">{monthlyTotals.present} present / {monthlyTotals.absent} absent</span>
        </div>
        <div className="max-h-[520px] overflow-auto">
          <table className="min-w-max border-collapse text-center text-xs">
            <thead className="sticky top-0 z-10">
              <tr className="bg-slate-200 text-slate-700"><th rowSpan={2} className="sticky left-0 z-20 w-10 border border-slate-300 bg-slate-200 px-2 py-1">Sr.</th><th rowSpan={2} className="sticky left-10 z-20 min-w-36 border border-slate-300 bg-slate-200 px-2 py-1 text-left">Employee</th>{monthDays.map(day => <th key={day.number} className={`w-8 border border-slate-300 px-1 py-1 ${day.weekend ? 'bg-red-700 text-white' : ''}`}><div>{day.name}</div><div className="font-black">{day.number}</div></th>)}<th colSpan={4} className="border border-slate-300 bg-slate-200 px-2 py-1">TOTAL</th></tr>
              <tr className="bg-slate-100 font-black"><th className="border border-slate-300 bg-green-600 px-2 py-1 text-white">PRESENT</th><th className="border border-slate-300 bg-red-700 px-2 py-1 text-white">ABSENT</th><th className="border border-slate-300 bg-amber-500 px-2 py-1 text-white">LATE</th><th className="border border-slate-300 bg-orange-500 px-2 py-1 text-white">HALF</th></tr>
            </thead>
            <tbody>{monthlyLoading ? <tr><td colSpan={monthDays.length + 6} className="p-8 text-slate-500">Loading attendance sheet...</td></tr> : monthlyEmployees.map((employee, index) => <tr key={employee.user_id} className="even:bg-slate-50"><td className="sticky left-0 z-[1] border border-slate-300 bg-inherit px-2 py-1 text-slate-500">{index + 1}</td><td className="sticky left-10 z-[1] border border-slate-300 bg-inherit px-2 py-1 text-left font-semibold text-slate-800">{employee.name}</td>{monthDays.map(day => { const status = employee.days?.[String(day.number)] as AttendanceStatus | undefined; return <td key={day.number} className={`border border-slate-300 px-1 py-1 font-black ${day.weekend ? 'bg-red-50' : ''} ${status === 'present' ? 'text-green-700' : status === 'absent' ? 'bg-red-100 text-red-700' : status === 'late' ? 'bg-amber-100 text-amber-700' : status === 'half_day' ? 'bg-orange-100 text-orange-700' : 'text-slate-300'}`}>{status ? statusShortLabels[status] : '-'}</td>; })}<td className="border border-slate-300 bg-green-50 px-2 py-1 font-black text-green-700">{employee.present}</td><td className="border border-slate-300 bg-red-50 px-2 py-1 font-black text-red-700">{employee.absent}</td><td className="border border-slate-300 bg-amber-50 px-2 py-1 font-black text-amber-700">{employee.late}</td><td className="border border-slate-300 bg-orange-50 px-2 py-1 font-black text-orange-700">{employee.half_day}</td></tr>)}</tbody>
          </table>
        </div>
      </section>

      {salarySlips.length > 0 && (
        <section className="overflow-hidden rounded-lg border border-emerald-200 bg-white shadow-sm">
          <div className="border-b border-emerald-200 bg-emerald-50 px-4 py-3">
            <h3 className="text-xl font-bold text-emerald-900">Salary Slips for {month}</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-emerald-50 text-emerald-900">
                <tr>
                  <th className="px-4 py-3 font-semibold">Employee</th>
                  <th className="px-4 py-3 font-semibold">Role</th>
                  <th className="px-4 py-3 font-semibold">Original Salary</th>
                  <th className="px-4 py-3 font-semibold">Payable Salary</th>
                  <th className="px-4 py-3 font-semibold">Deduction</th>
                  <th className="px-4 py-3 font-semibold">Net Salary</th>
                  <th className="px-4 py-3 font-semibold">Present</th>
                  <th className="px-4 py-3 font-semibold">Late</th>
                  <th className="px-4 py-3 font-semibold">Half</th>
                  <th className="px-4 py-3 font-semibold">Absent</th>
                  <th className="px-4 py-3 font-semibold">Download</th>
                </tr>
              </thead>
              <tbody>
                {salarySlips.map(slip => (
                  <tr key={slip.employeeId} className="border-t border-slate-200">
                    <td className="px-4 py-3"><div className="font-medium text-slate-900">{slip.employeeName}</div><div className="text-xs text-slate-500">{slip.email}</div></td>
                    <td className="px-4 py-3 text-slate-600">{slip.roleName || 'Employee'}</td>
                    <td className="px-4 py-3 font-semibold text-slate-900">PKR {Number(slip.originalMonthlySalary ?? 0).toLocaleString('en-PK')}</td>
                    <td className="px-4 py-3 font-semibold text-slate-900">PKR {Number(slip.payableSalary ?? slip.monthlySalary ?? 0).toLocaleString('en-PK')}</td>
                    <td className="px-4 py-3 text-amber-700">PKR {Number(slip.deductionAmount || 0).toLocaleString('en-PK')}</td>
                    <td className="px-4 py-3 font-bold text-emerald-700">PKR {Number(slip.netSalary || 0).toLocaleString('en-PK')}</td>
                    <td className="px-4 py-3">{slip.presentDays}</td>
                    <td className="px-4 py-3">{slip.lateDays}</td>
                    <td className="px-4 py-3">{slip.halfDays}</td>
                    <td className="px-4 py-3">{slip.absentDays}</td>
                    <td className="px-4 py-3"><button onClick={() => downloadSingleSalarySlip(slip)} className="rounded bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700">Download</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}