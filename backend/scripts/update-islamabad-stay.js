require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function updateIslamabadStay() {
  const client = await pool.connect();
  try {
    console.log('🔄 Updating Islamabad Stay values for existing leads...');

    // Get all leads
    const result = await client.query('SELECT id FROM leads ORDER BY created_at DESC LIMIT 20');
    const leads = result.rows;

    console.log(`Found ${leads.length} leads to update`);

    // Alternate between 'yes' and 'no' for Islamabad Stay
    for (let i = 0; i < leads.length; i++) {
      const islamabadStay = i % 2 === 0 ? 'yes' : 'no';
      await client.query('UPDATE leads SET islamabad_stay = $1 WHERE id = $2', [islamabadStay, leads[i].id]);
      console.log(`✅ Lead ${i + 1}: Islamabad Stay = ${islamabadStay}`);
    }

    console.log('✅ All leads updated with Islamabad Stay values!');
    pool.end();
  } catch (error) {
    console.error('Error:', error.message);
    pool.end();
    process.exit(1);
  }
}

updateIslamabadStay();
