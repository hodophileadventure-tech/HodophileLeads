require('dotenv').config();
const { Pool } = require('pg');
const bcryptjs = require('bcryptjs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function seed() {
  try {
    console.log('🌱 Starting database seeding...');

    // Hash passwords
    const adminPassword = await bcryptjs.hash('Admin@123', 10);
    const agentPassword = await bcryptjs.hash('Agent@123', 10);

    // Insert demo users
    const insertUsers = `
      INSERT INTO users (email, name, password, role) 
      VALUES 
        ($1, $2, $3, $4),
        ($5, $6, $7, $8)
      ON CONFLICT (email) DO NOTHING;
    `;

    await pool.query(insertUsers, [
      'admin@tripnexus.com',
      'Admin User',
      adminPassword,
      'admin',
      'agent@tripnexus.com',
      'Agent User',
      agentPassword,
      'agent',
    ]);

    console.log('✅ Seeding completed successfully!');
    console.log('\n📋 Demo Credentials:');
    console.log('  Admin: admin@tripnexus.com / Admin@123');
    console.log('  Agent: agent@tripnexus.com / Agent@123\n');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seed();
