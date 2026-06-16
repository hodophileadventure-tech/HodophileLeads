require('dotenv').config();
const { Pool } = require('pg');
const bcryptjs = require('bcryptjs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function seed() {
  const client = await pool.connect();
  try {
    console.log('🌱 Starting database seeding...');
    await client.query('BEGIN');

    // Hash admin password
    const adminPassword = await bcryptjs.hash('admin@123', 10);

    // 1. Insert admin user only
    const usersResult = await client.query(`
      INSERT INTO users (email, name, password, role) 
      VALUES 
        ($1, $2, $3, $4)
      ON CONFLICT (email) DO NOTHING
      RETURNING id, email, role;
    `, [
      'admin@hodophile.com',
      'Admin User',
      adminPassword,
      'admin'
    ]);

    console.log('✅ Admin user inserted');
    const adminId = usersResult.rows.find(r => r.role === 'admin')?.id;

    // 2. Insert sample leads
    const leadsResult = await client.query(`
      INSERT INTO leads 
      (name, email, phone, destination, budget, source, temperature, status, agent_id, special_requests, islamabad_stay)
      VALUES 
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11),
        ($12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
      ON CONFLICT DO NOTHING
      RETURNING id;
    `, [
      'John Doe', 'john@example.com', '+1-555-0101', 'Paris, France', 
      5000, 'website', 'hot', 'potential', adminId, 'Honeymoon trip', 'yes',
      
      'Jane Smith', 'jane@example.com', '+1-555-0102', 'Tokyo, Japan',
      8000, 'referral', 'warm', 'potential', adminId, 'Family vacation with kids', 'no'
    ]);

    const leadIds = leadsResult.rows.map(r => r.id);
    console.log('✅ Sample leads inserted');

    // 3. Insert sample follow-ups
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowISO = tomorrow.toISOString();

    await client.query(`
      INSERT INTO follow_ups (lead_id, task_type, status, due_date, notes, assigned_to)
      VALUES 
        ($1, $2, $3, $4, $5, $6),
        ($7, $8, $9, $10, $11, $12)
      ON CONFLICT DO NOTHING;
    `, [
      leadIds[0], 'reminder', 'upcoming', tomorrowISO, 'Confirm hotel bookings for Paris stay', adminId,
      leadIds[1], 'reminder', 'upcoming', tomorrowISO, 'Send payment reminder to client', adminId
    ]);

    console.log('✅ Sample follow-ups inserted');

    // 4. Insert sample payments
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);
    const dueDateISO = dueDate.toISOString().split('T')[0]; // Convert to date format

    await client.query(`
      INSERT INTO payments (lead_id, amount, status, payment_date)
      VALUES 
        ($1, $2, $3, $4),
        ($5, $6, $7, $8)
      ON CONFLICT DO NOTHING;
    `, [
      leadIds[0], 2500, 'pending', dueDateISO,
      leadIds[1], 4000, 'pending', dueDateISO
    ]);

    console.log('✅ Sample payments inserted');

    await client.query('COMMIT');
    console.log('\n✅ ✅ ✅ Database seeding completed!\n');
    console.log('📋 Admin Credential:');
    console.log('  Admin: admin@hodophile.com / admin@123\n');
    console.log('📊 Sample Data Created:');
    console.log('  - Admin user');
    console.log('  - 2 sample leads');
    console.log('  - 2 follow-ups');
    console.log('  - 2 payments\n');
    process.exit(0);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Seeding failed:', error.message);
    console.error('Details:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
