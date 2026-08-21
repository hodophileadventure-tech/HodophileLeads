import { useEffect, useState } from 'react';
import axios from 'axios';

const RAW_API_BASE = (import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? 'http://localhost:5000' : '')).replace(/\/$/, '');
const API_BASE = RAW_API_BASE.replace(/\/api\/?$/, '');
const API_PREFIX = API_BASE ? `${API_BASE}/api` : '/api';

type AttendanceStatus = 'present' | 'late' | 'absent' | 'half_day';
type Employee = { user_id: string; name: string; email: string; role_name?: string; status?: AttendanceStatus; note?: string };
const statusLabels: Record<AttendanceStatus, string> = { present: 'Present', late: 'Late', absent: 'Absent', half_day: 'Half Day' };

const today = () => new Date().toLocaleDateString('en-CA');
const authConfig = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });

export default function AttendancePage() {
  const [date, setDate] = useState(today);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true); setError(''); setMessage('');
      try {
        const response = await axios.get(`${API_PREFIX}/admin/attendance?date=${date}`, authConfig());
        setEmployees(response.data.employees || []);
      } catch (err: any) {
        setError(err.response?.data?.error || 'Failed to load attendance');
      } finally { setLoading(false); }
    };
    void load();
  }, [date]);

  const updateEmployee = (userId: string, changes: Partial<Employee>) => {
    setEmployees(current => current.map(employee => employee.user_id === userId ? { ...employee, ...changes } : employee));
  };

  const save = async () => {
    setSaving(true); setError(''); setMessage('');
    try {
      await axios.put(`${API_PREFIX}/admin/attendance`, {
        date,
        records: employees.map(employee => ({ userId: employee.user_id, status: employee.status || 'present', note: employee.note || '' }))
      }, authConfig());
      setMessage('Attendance saved successfully.');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save attendance');
    } finally { setSaving(false); }
  };

  const counts = employees.reduce((result, employee) => { const status = employee.status || 'unmarked'; result[status] = (result[status] || 0) + 1; return result; }, {} as Record<string, number>);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900">Employee Attendance</h1><p className="mt-1 text-gray-600">Mark attendance for your team by date.</p></div>
        <div className="flex items-end gap-3"><label className="text-sm font-medium text-gray-700">Date<input type="date" value={date} onChange={event => setDate(event.target.value)} className="mt-1 block rounded border border-gray-300 px-3 py-2" /></label><button onClick={save} disabled={saving || loading || employees.length === 0} className="rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50">{saving ? 'Saving...' : 'Save Attendance'}</button></div>
      </div>
      {(message || error) && <div className={`rounded border p-3 ${error ? 'border-red-200 bg-red-50 text-red-700' : 'border-green-200 bg-green-50 text-green-700'}`}>{error || message}</div>}
      <div className="flex flex-wrap gap-3 text-sm"><span className="rounded bg-gray-100 px-3 py-1">Total: {employees.length}</span><span className="rounded bg-green-100 px-3 py-1 text-green-800">Present: {counts.present || 0}</span><span className="rounded bg-yellow-100 px-3 py-1 text-yellow-800">Late: {counts.late || 0}</span><span className="rounded bg-red-100 px-3 py-1 text-red-800">Absent: {counts.absent || 0}</span><span className="rounded bg-orange-100 px-3 py-1 text-orange-800">Half Day: {counts.half_day || 0}</span></div>
      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white"><table className="w-full"><thead className="bg-gray-50"><tr><th className="px-5 py-3 text-left text-sm font-semibold">Employee</th><th className="px-5 py-3 text-left text-sm font-semibold">Role</th><th className="px-5 py-3 text-left text-sm font-semibold">Status</th><th className="px-5 py-3 text-left text-sm font-semibold">Note</th></tr></thead><tbody className="divide-y divide-gray-200">{loading ? <tr><td colSpan={4} className="p-6 text-center text-gray-500">Loading employees...</td></tr> : employees.length === 0 ? <tr><td colSpan={4} className="p-6 text-center text-gray-500">No employees found.</td></tr> : employees.map(employee => <tr key={employee.user_id}><td className="px-5 py-3"><div className="font-medium text-gray-900">{employee.name}</div><div className="text-xs text-gray-500">{employee.email}</div></td><td className="px-5 py-3 text-sm text-gray-600">{employee.role_name || 'Employee'}</td><td className="px-5 py-3"><select value={employee.status || ''} onChange={event => updateEmployee(employee.user_id, { status: event.target.value as AttendanceStatus })} className="rounded border border-gray-300 px-3 py-2 text-sm"><option value="">Select status</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></td><td className="px-5 py-3"><input value={employee.note || ''} onChange={event => updateEmployee(employee.user_id, { note: event.target.value })} placeholder="Optional note" className="w-full min-w-48 rounded border border-gray-300 px-3 py-2 text-sm" /></td></tr>)}</tbody></table></div>
    </div>
  );
}