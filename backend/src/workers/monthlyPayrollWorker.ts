import cron from 'node-cron';
import { generateMonthlySalaryReport } from '../services/salary-policy';

export const startMonthlyPayrollWorker = () => {
  cron.schedule('0 10 1 * *', async () => {
    try {
      const month = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 7);
      await generateMonthlySalaryReport(month, true);
      console.log('[PayrollWorker] Monthly salary slips generated for', month);
    } catch (error) {
      console.error('[PayrollWorker] Failed to generate monthly salary slips', error);
    }
  });
};
