const { enqueueConfirmedLeadNotification } = require('../dist/services/employeePortalService');
const { query } = require('../dist/utils/database');

(async () => {
  try {
    const res = await query('SELECT * FROM leads WHERE id = $1', ['55592607-1f37-4759-b540-917dc741cf6c']);
    const lead = res.rows[0];
    console.log('Lead loaded:', !!lead);
    const ev = await enqueueConfirmedLeadNotification(lead);
    console.log('Enqueue result:', ev);
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();