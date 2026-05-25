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

    // Hash passwords
    const adminPassword = await bcryptjs.hash('Admin@123', 10);
    const agentPassword = await bcryptjs.hash('Agent@123', 10);

    // 1. Insert demo users
    const usersResult = await client.query(`
      INSERT INTO users (email, name, password, role) 
      VALUES 
        ($1, $2, $3, $4),
        ($5, $6, $7, $8)
      ON CONFLICT (email) DO NOTHING
      RETURNING id, email, role;
    `, [
      'admin@tripnexus.com',
      'Admin User',
      adminPassword,
      'admin',
      'agent@tripnexus.com',
      'Agent User',
      agentPassword,
      'agent',
    ]);

    console.log('✅ Demo users inserted');
    
    const adminId = usersResult.rows.find(r => r.role === 'admin')?.id;
    const agentId = usersResult.rows.find(r => r.role === 'agent')?.id;

    if (!agentId) {
      console.log('⚠️  Agent user already exists, skipping sample leads');
      await client.query('COMMIT');
      console.log('\n✅ ✅ ✅ Database seeding completed!\n');
      console.log('📋 Demo Credentials:');
      console.log('  Admin: admin@tripnexus.com / Admin@123');
      console.log('  Agent: agent@tripnexus.com / Agent@123\n');
      process.exit(0);
    }

    // 2. Insert sample client profiles
    const profilesResult = await client.query(`
      INSERT INTO client_profiles (phone, name, email, address, gender, age, loyalty_tier, total_trips)
      VALUES 
        ($1, $2, $3, $4, $5, $6, $7, $8),
        ($9, $10, $11, $12, $13, $14, $15, $16)
      ON CONFLICT (phone) DO NOTHING
      RETURNING id;
    `, [
      '+1-555-0101', 'John Doe', 'john@example.com', '123 Main St, NY', 'Male', 45, 'gold', 5,
      '+1-555-0102', 'Jane Smith', 'jane@example.com', '456 Oak Ave, CA', 'Female', 38, 'silver', 3
    ]);

    const profileIds = profilesResult.rows.map(r => r.id);
    console.log('✅ Sample client profiles inserted');

    // 3. Insert sample leads
    const leadsResult = await client.query(`
      INSERT INTO leads 
      (client_name, email, phone, destination, travel_dates, budget, source, temperature, status, agent_id, profile_id, persons, special_requests)
      VALUES 
        ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $10, $11, $12, $13),
        ($14, $15, $16, $17, $18::jsonb, $19, $20, $21, $22, $23, $24, $25, $26)
      ON CONFLICT DO NOTHING
      RETURNING id;
    `, [
      'John Doe', 'john@example.com', '+1-555-0101', 'Paris, France', 
      JSON.stringify({ start: '2026-07-01', end: '2026-07-15' }), 
      5000, 'website', 'hot', 'interested', agentId, profileIds[0], 2, 'Honeymoon trip',
      
      'Jane Smith', 'jane@example.com', '+1-555-0102', 'Tokyo, Japan',
      JSON.stringify({ start: '2026-08-01', end: '2026-08-21' }),
      8000, 'referral', 'warm', 'negotiation', agentId, profileIds[1], 3, 'Family vacation with kids'
    ]);

    const leadIds = leadsResult.rows.map(r => r.id);
    console.log('✅ Sample leads inserted');

    // 4. Insert sample itineraries
    await client.query(`
      INSERT INTO itineraries (lead_id, trip_plan, total_cost, status)
      VALUES 
        ($1, $2::jsonb, $3, $4),
        ($5, $6::jsonb, $7, $8)
      ON CONFLICT DO NOTHING;
    `, [
      leadIds[0], JSON.stringify([
        { day: 1, activity: 'Arrival at Paris CDG', location: 'Paris' },
        { day: 2, activity: 'Eiffel Tower & Louvre Museum', location: 'Paris' },
        { day: 3, activity: 'Versailles Day Trip', location: 'Versailles' }
      ]), 4500, 'draft',
      leadIds[1], JSON.stringify([
        { day: 1, activity: 'Arrival at Narita Airport', location: 'Tokyo' },
        { day: 2, activity: 'Tokyo Tower & Asakusa Temple', location: 'Tokyo' },
        { day: 3, activity: 'Mount Fuji Day Trip', location: 'Hakone' }
      ]), 7500, 'draft'
    ]);

    console.log('✅ Sample itineraries inserted');

    // 5. Insert sample availability records
    await client.query(`
      INSERT INTO availability (lead_id, hotel_confirmed, transport_confirmed, guide_confirmed)
      VALUES 
        ($1, $2, $3, $4),
        ($5, $6, $7, $8)
      ON CONFLICT DO NOTHING;
    `, [
      leadIds[0], true, false, false,
      leadIds[1], false, false, false
    ]);

    console.log('✅ Sample availability records inserted');

    // 6. Insert sample follow-ups
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    await client.query(`
      INSERT INTO follow_ups (lead_id, type, title, description, due_date, status, priority, assigned_to)
      VALUES 
        ($1, $2, $3, $4, $5, $6, $7, $8),
        ($9, $10, $11, $12, $13, $14, $15, $16)
      ON CONFLICT DO NOTHING;
    `, [
      leadIds[0], 'manual', 'Hotel Confirmation', 'Confirm hotel bookings for Paris stay', tomorrow, 'upcoming', 'high', agentId,
      leadIds[1], 'auto', 'Payment Reminder', 'Send payment reminder to client', tomorrow, 'upcoming', 'medium', agentId
    ]);

    console.log('✅ Sample follow-ups inserted');

    // 7. Insert sample payments
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);

    await client.query(`
      INSERT INTO payments (lead_id, amount, status, method, due_date, notes)
      VALUES 
        ($1, $2, $3, $4, $5, $6),
        ($7, $8, $9, $10, $11, $12)
      ON CONFLICT DO NOTHING;
    `, [
      leadIds[0], 2500, 'pending', 'bank_transfer', dueDate, 'Initial deposit for Paris trip',
      leadIds[1], 4000, 'approved', 'card', dueDate, 'Advance payment for Japan trip'
    ]);

    console.log('✅ Sample payments inserted');

    await client.query('COMMIT');
    console.log('\n✅ ✅ ✅ Database seeding completed!\n');
    console.log('📋 Demo Credentials:');
    console.log('  Admin: admin@tripnexus.com / Admin@123');
    console.log('  Agent: agent@tripnexus.com / Agent@123\n');
    console.log('📊 Sample Data Created:');
    console.log('  - 2 demo users');
    console.log('  - 2 client profiles');
    console.log('  - 2 leads');
    console.log('  - 2 itineraries');
    console.log('  - 2 availability records');
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
