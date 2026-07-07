const express = require('express');
const bodyParser = require('body-parser');
const { Client } = require('pg');

const PORT = 4000;
const app = express();
app.use(bodyParser.json());

const db = new Client({
  connectionString: process.env.PORTAL_DB_URL || 'postgresql://postgres:postgres@localhost:5432/hodophile_portal'
});

(async () => {
  await db.connect();

  const server = app.listen(PORT, () => {
    console.log('Portal stub listening on', PORT);
  });

  app.post('/api/sales/leads', async (req, res) => {
    try {
      const p = req.body;
      // For smoke test: use a test Employee to satisfy FK when payload lacks employeeId
      const TEST_EMPLOYEE_ID = 'ecdde89f-975f-4f37-9da7-22e803c2ca63';

      // map payload to SalesLead columns
      const insertSql = `INSERT INTO "SalesLead" ("id","employeeId","customerName","customerNumber","destination","persons","leadWorth","commission","sourceLeadId","sourceSystem","confirmed","confirmedAt","createdAt","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW(),NOW()) RETURNING *`;
      const id = require('crypto').randomUUID();
      const employeeIdToInsert = p.employeeId || TEST_EMPLOYEE_ID;
      const params = [id, employeeIdToInsert, p.customerName || null, p.customerNumber || null, p.destination || null, p.persons || 1, p.leadWorth || 0, p.commission || 0, p.leadId || null, p.sourceSystem || null, true, p.confirmedAt ? new Date(p.confirmedAt) : new Date()];
      const sl = await db.query(insertSql, params);

      // Insert a SalaryRecord for this employee for current month
      let sr = null;
      if (employeeIdToInsert) {
        const salaryId = require('crypto').randomUUID();
        const month = new Date(); month.setDate(1); month.setHours(0,0,0,0);
        const salarySql = `INSERT INTO "SalaryRecord" ("id","employeeId","commission","month","createdAt","updatedAt","status","earnedSalary","totalSalary","netSalary","monthlyIncentive","daysWorked","deductions") VALUES ($1,$2,$3,$4,NOW(),NOW(),'pending',0,0,0,0,0,0) RETURNING *`;
        const sparams = [salaryId, employeeIdToInsert, p.commission || 0, month];
        sr = await db.query(salarySql, sparams);
      }

      res.status(201).json({ salesLead: sl.rows[0], salaryRecord: sr.rows[0] });

      // shut down after handling this one request
      setTimeout(async () => {
        await db.end();
        server.close(() => process.exit(0));
      }, 100);

    } catch (err) {
      console.error('Stub error', err);
      res.status(500).json({ error: String(err) });
      process.exit(1);
    }
  });
})();