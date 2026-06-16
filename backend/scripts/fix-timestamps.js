require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function fix() {
  const client = await pool.connect();
  try {
    console.log('🔄 Updating lead timestamps...');

    // Get all leads ordered by current created_at
    const result = await client.query('SELECT id FROM leads ORDER BY id ASC LIMIT 20');
    const leads = result.rows;

    console.log(`Found ${leads.length} leads to update`);

    // Update with staggered timestamps (each 2 hours apart, going back)
    for (let i = 0; i < leads.length; i++) {
      const hoursAgo = i * 2; // Each lead is 2 hours apart
      const newTime = new Date(Date.now() - hoursAgo * 3600000).toISOString();
      await client.query('UPDATE leads SET created_at = $1 WHERE id = $2', [newTime, leads[i].id]);
      console.log(`✅ Lead ${i + 1}: ${newTime}`);
    }

    console.log('✅ All lead timestamps updated!');
    pool.end();
  } catch (error) {
    console.error('Error:', error.message);
    pool.end();
    process.exit(1);
  }
}

fix();
