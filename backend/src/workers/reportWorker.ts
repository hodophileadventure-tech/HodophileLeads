import cron from 'node-cron';
import { query } from '../utils/database';
import { dailyReportsModel } from '../models/DailyReport';

const formatDate = (date: Date) => date.toISOString().slice(0, 10);

const getStartOfWeek = (date: Date) => {
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(date);
  monday.setDate(diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
};

const getEndOfWeek = (date: Date) => {
  const monday = getStartOfWeek(date);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return sunday;
};

const getStartOfMonth = (date: Date) => {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  start.setHours(0, 0, 0, 0);
  return start;
};

const getEndOfMonth = (date: Date) => {
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  end.setHours(23, 59, 59, 999);
  return end;
};

const compileReport = async (userId: string, reportType: 'daily' | 'weekly' | 'monthly', targetDate: Date) => {
  let periodStart: Date;
  let periodEnd: Date;
  let reportDate: string;

  if (reportType === 'daily') {
    periodStart = new Date(targetDate);
    periodStart.setHours(0, 0, 0, 0);
    periodEnd = new Date(targetDate);
    periodEnd.setHours(23, 59, 59, 999);
    reportDate = formatDate(targetDate);
  } else if (reportType === 'weekly') {
    periodStart = getStartOfWeek(targetDate);
    periodEnd = getEndOfWeek(targetDate);
    reportDate = formatDate(targetDate);
  } else {
    periodStart = getStartOfMonth(targetDate);
    periodEnd = getEndOfMonth(targetDate);
    reportDate = formatDate(targetDate);
  }

  const activitiesQuery = `
    SELECT entity_type, action, changes, user_id, created_at
    FROM audit_logs
    WHERE user_id = $1
      AND created_at BETWEEN $2 AND $3
    ORDER BY created_at ASC
  `;
  const activityResult = await query(activitiesQuery, [userId, periodStart.toISOString(), periodEnd.toISOString()]);

  const totals = {
    leadsCreated: 0,
    followUpsCreated: 0,
    followUpsCompleted: 0,
    quotesRequested: 0,
    quotesSaved: 0,
    paymentsCreated: 0,
    paymentsConfirmed: 0,
    bookingsCompleted: 0,
    otherActions: 0
  };

  const actions: any[] = [];
  for (const row of activityResult.rows) {
    const action = String(row.action || '');
    const type = String(row.entity_type || '');
    const changes = row.changes || {};
    actions.push({ entityType: type, action, changes, timestamp: row.created_at });

    if (type === 'lead' && action === 'create') totals.leadsCreated += 1;
    if (type === 'follow_up' && action === 'create') totals.followUpsCreated += 1;
    if (type === 'follow_up' && action === 'complete') totals.followUpsCompleted += 1;
    if (type === 'quote_request' && action === 'create') totals.quotesRequested += 1;
    if (type === 'quote_request' && action === 'save') totals.quotesSaved += 1;
    if (type === 'payment' && action === 'create') totals.paymentsCreated += 1;
    if (type === 'payment' && action === 'confirm') totals.paymentsConfirmed += 1;
    if (type === 'lead' && action === 'update' && (changes?.status === 'booked' || changes?.pipelineStage === 'confirmed')) totals.bookingsCompleted += 1;
    if (!['lead', 'follow_up', 'quote_request', 'payment'].includes(type)) totals.otherActions += 1;
  }

  const reportData = {
    targetDate: reportDate,
    periodStart: formatDate(periodStart),
    periodEnd: formatDate(periodEnd),
    totals,
    actions
  };

  return dailyReportsModel.upsert({
    reportType,
    reportDate,
    userId,
    periodStart: formatDate(periodStart),
    periodEnd: formatDate(periodEnd),
    reportData,
    totalActivities: actions.length
  });
};

const compileAllReports = async () => {
  try {
    const usersResult = await query(`SELECT id FROM users WHERE role = 'agent' OR role = 'admin'`);
    const userIds = usersResult.rows.map((row: any) => row.id);
    const today = new Date();
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() - 1);

    for (const userId of userIds) {
      await compileReport(userId, 'daily', targetDate);
      await compileReport(userId, 'weekly', targetDate);
      await compileReport(userId, 'monthly', targetDate);
    }
  } catch (error) {
    console.error('[ReportWorker] Failed to compile reports', error);
  }
};

export const startReportWorker = () => {
  cron.schedule('0 20 * * *', async () => {
    console.log('[ReportWorker] Running nightly report compile at 20:00');
    await compileAllReports();
  }, {
    scheduled: true,
    timezone: 'Asia/Karachi'
  });
};

export const compileReportForUser = async (userId: string, reportType: 'daily' | 'weekly' | 'monthly', date: Date) => {
  return compileReport(userId, reportType, date);
};

export { compileAllReports };
