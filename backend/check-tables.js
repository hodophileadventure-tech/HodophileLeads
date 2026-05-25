require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function checkTables() {
  try {
    const result = await pool.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    console.log('📊 Tables in Railway database:');
    if (result.rows.length === 0) {
      console.log('❌ No tables found!');
    } else {
      result.rows.forEach(r => console.log('  ✅', r.table_name));
      console.log(`\nTotal: ${result.rows.length} tables`);
    }
    
    // Also check users table for demo data
    if (result.rows.some(r => r.table_name === 'users')) {
      const usersResult = await pool.query('SELECT COUNT(*) as count FROM users');
      console.log(`\n👥 Users in database: ${usersResult.rows[0].count}`);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

checkTables();
