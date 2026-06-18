import React, { useEffect, useState } from 'react';
import { Button, Card, Spinner } from '../components/common';
import { reportsAPI } from '../utils/api-service';
import { useAuth } from '../context/AuthContext';
import { formatKarachiDateTime } from '../utils/helpers';

const reportTypes = ['daily', 'weekly', 'monthly'] as const;
type ReportType = typeof reportTypes[number];

const DailyReportsPage: React.FC = () => {
  const [reportType, setReportType] = useState<ReportType>('daily');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [report, setReport] = useState<any | null>(null);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const selectedEmployeeReport = report?.reportRows?.find((row: any) => String(row.id) === String(selectedReportId)) || null;

  const fetchReports = async () => {
    setLoading(true);
    setError('');
    try {
      const resp = isAdmin
        ? await reportsAPI.listAdminReports(reportType, date)
        : await reportsAPI.listMyReports(reportType, 1, 30);
      setReports(Array.isArray(resp.data.reports) ? resp.data.reports : []);
    } catch (err) {
      console.error('Failed to load reports', err);
      setError('Unable to load report history.');
    } finally {
      setLoading(false);
    }
  };

  const downloadReportExport = async () => {
    if (!isAdmin) return;
    try {
      const resp = await reportsAPI.exportAdminReports(reportType, date);
      const blob = new Blob([resp.data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `tripnexus-reports-${reportType}-${date}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export reports', err);
      setError('Export failed.');
    }
  };

  const compileReportsNow = async () => {
    if (!isAdmin) return;
    setLoading(true);
    try {
      await reportsAPI.compileAllReportsNow();
      setError('');
      await fetchReport();
      await fetchReports();
    } catch (err: any) {
      console.error('Failed to compile reports', err);
      setError('Failed to compile reports: ' + (err?.response?.data?.message || err?.message));
    } finally {
      setLoading(false);
    }
  };

  const fetchReport = async () => {
    if (!date) return;
    setLoading(true);
    setError('');
    try {
      if (isAdmin) {
        const resp = await reportsAPI.listAdminReports(reportType, date);
        const reportRows = Array.isArray(resp.data.reports) ? resp.data.reports : [];
        const totals = reportRows.reduce((acc: Record<string, number>, item: any) => {
          const itemTotals = item.report_data?.totals || {};
          Object.entries(itemTotals).forEach(([key, value]) => {
            acc[key] = (acc[key] || 0) + Number(value || 0);
          });
          return acc;
        }, {});

        setReport({
          report_date: date,
          report_data: {
            periodStart: resp.data.period?.start || date,
            periodEnd: resp.data.period?.end || date,
            totals,
            actions: []
          },
          total_activities: reportRows.reduce((sum: number, item: any) => sum + Number(item.total_activities || item.totalActivities || 0), 0),
          employeeCount: reportRows.length,
          reportRows
        });
        setSelectedReportId(reportRows[0]?.id ? String(reportRows[0].id) : null);
      } else {
        const resp = await reportsAPI.getMyReport(reportType, date);
        setReport(resp.data);
      }
    } catch (err: any) {
      console.error('Failed to load report', err);
      setReport(null);
      setError(err?.response?.status === 404 ? 'Report not compiled yet. It will be generated at 8:00 PM.' : 'Unable to load report.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [reportType, date]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Reports</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Automatically tracked daily, weekly, and monthly activity summaries for every employee.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {reportTypes.map((type) => (
            <Button
              key={type}
              variant={reportType === type ? 'primary' : 'secondary'}
              onClick={() => setReportType(type)}
            >
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </Button>
          ))}
        </div>
      </div>

      <Card className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Select Date</label>
            <input
              type="date"
              className="input-field mt-2"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={fetchReport}>Load Report</Button>
            <Button variant="secondary" onClick={fetchReports}>Refresh History</Button>
            {isAdmin && (
              <>
                <Button variant="secondary" onClick={compileReportsNow} disabled={loading}>
                  {loading ? 'Compiling...' : 'Compile Now'}
                </Button>
                <Button variant="secondary" onClick={downloadReportExport}>Export Reports</Button>
              </>
            )}
          </div>
        </div>
        {loading && (
          <div className="flex justify-center py-8">
            <Spinner size="lg" />
          </div>
        )}
        {error && <p className="text-red-600">{error}</p>}
        {report && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
                <h3 className="text-sm font-semibold">Report Date</h3>
                <p className="mt-2 text-lg">{report.report_date}</p>
              </div>
              <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
                <h3 className="text-sm font-semibold">Period</h3>
                <p className="mt-2 text-lg">{report.report_data?.periodStart} — {report.report_data?.periodEnd}</p>
              </div>
              <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
                <h3 className="text-sm font-semibold">Total Activities</h3>
                <p className="mt-2 text-lg">{report.total_activities}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries((report.report_data?.totals as Record<string, any>) || {}).map(([key, value]) => (
                <div key={key} className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
                  <h4 className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{key.replace(/([A-Z])/g, ' $1')}</h4>
                  <p className="mt-2 text-xl font-semibold">{String(value)}</p>
                </div>
              ))}
            </div>
            <div>
              <h2 className="text-xl font-semibold">Actions</h2>
              <div className="mt-3 space-y-2">
                {Array.isArray(report.report_data?.actions) && report.report_data.actions.length > 0 ? (
                  report.report_data.actions.map((action: any, index: number) => (
                    <div key={index} className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 bg-white dark:bg-slate-900">
                      <div className="flex justify-between items-start gap-4">
                        <div>
                          <div className="font-semibold">{action.entityType} · {action.action}</div>
                          <div className="text-slate-500 dark:text-slate-400 text-sm">{JSON.stringify(action.changes)}</div>
                        </div>
                        <div className="text-xs text-slate-400">{formatKarachiDateTime(action.timestamp)}</div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-slate-600 dark:text-slate-400">No actions recorded for this period yet.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {isAdmin && report && Array.isArray(report.reportRows) && report.reportRows.length > 0 && (
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
              <div className="px-4 py-3 bg-slate-100 dark:bg-slate-800 text-sm font-semibold text-slate-700 dark:text-slate-200">
                Employee Activity Summary
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm text-left">
                  <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 uppercase text-xs">
                    <tr>
                      <th className="px-4 py-3">Employee</th>
                      <th className="px-4 py-3">Email</th>
                      <th className="px-4 py-3">Activities</th>
                      <th className="px-4 py-3">Report Date</th>
                      <th className="px-4 py-3">Period</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.reportRows.map((row: any) => {
                      const isSelected = String(row.id) === String(selectedReportId);
                      return (
                        <tr
                          key={row.id}
                          onClick={() => setSelectedReportId(String(row.id))}
                          className={`cursor-pointer border-t border-slate-200 dark:border-slate-700 ${isSelected ? 'bg-slate-100 dark:bg-slate-800' : 'bg-white dark:bg-slate-900'} hover:bg-slate-50 dark:hover:bg-slate-800`}
                        >
                          <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">{row.userName || row.user_name || 'Unknown'}</td>
                          <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{row.userEmail || row.user_email || '—'}</td>
                          <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{row.total_activities || row.totalActivities || 0}</td>
                          <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{row.report_date}</td>
                          <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{row.period_start || row.periodStart} — {row.period_end || row.periodEnd}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {selectedEmployeeReport && (
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-4">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
                  <div>
                    <h3 className="text-lg font-semibold">{selectedEmployeeReport.userName || selectedEmployeeReport.user_name}</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{selectedEmployeeReport.userEmail || selectedEmployeeReport.user_email}</p>
                  </div>
                  <div className="text-sm text-slate-600 dark:text-slate-400">
                    Activities: {selectedEmployeeReport.total_activities || selectedEmployeeReport.totalActivities || 0}
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                  <div className="rounded-xl bg-white dark:bg-slate-900 p-3">
                    <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Report Date</div>
                    <div className="mt-2 font-semibold">{selectedEmployeeReport.report_date}</div>
                  </div>
                  <div className="rounded-xl bg-white dark:bg-slate-900 p-3">
                    <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Period</div>
                    <div className="mt-2 font-semibold">{selectedEmployeeReport.period_start || selectedEmployeeReport.periodStart} — {selectedEmployeeReport.period_end || selectedEmployeeReport.periodEnd}</div>
                  </div>
                  <div className="rounded-xl bg-white dark:bg-slate-900 p-3">
                    <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Updated</div>
                    <div className="mt-2 font-semibold">{selectedEmployeeReport.updated_at || selectedEmployeeReport.updatedAt}</div>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.entries((selectedEmployeeReport.report_data?.totals as Record<string, any>) || {}).map(([key, value]) => (
                    <div key={key} className="rounded-xl bg-white dark:bg-slate-900 p-3">
                      <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{key.replace(/([A-Z])/g, ' $1')}</div>
                      <div className="mt-2 font-semibold">{String(value)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Card>

      <Card>
        <h2 className="text-xl font-semibold mb-3">Report History</h2>
        {reports.length === 0 ? (
          <p className="text-slate-600 dark:text-slate-400">No reports available yet for this type.</p>
        ) : (
          <div className="space-y-3">
            {reports.map((item) => (
              <div key={item.id} className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 bg-slate-50 dark:bg-slate-800">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold">{item.report_date}</div>
                    <div className="text-sm text-slate-500 dark:text-slate-400">{item.report_data?.periodStart} — {item.report_data?.periodEnd}</div>
                  </div>
                  <div className="text-sm text-slate-600 dark:text-slate-400">Activities: {item.total_activities}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

export default DailyReportsPage;
