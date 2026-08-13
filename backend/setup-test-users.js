/**
 * Phase 2 API Test - Setup Test Users
 * Creates test users in database with proper role assignments
 */

const jwt = require('jsonwebtoken');
const { Client } = require('pg');
const crypto = require('crypto');

const JWT_SECRET = 'super-secret-key';

// PostgreSQL connection
const client = new Client({
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'tripnexus'
});

// Test user IDs to create
const TEST_USERS = [
  {
    id: '550e8400-e29b-41d4-a716-446655440001',
    email: 'admin@test.com',
    name: 'Admin User',
    roleSlug: 'admin',
    password: 'test123456'
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440002',
    email: 'agent@test.com',
    name: 'Agent User',
    roleSlug: 'agent',
    password: 'test123456'
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440003',
    email: 'manager@test.com',
    name: 'Manager User',
    roleSlug: 'manager',
    password: 'test123456'
  }
];

async function setupTestUsers() {
  try {
    await client.connect();
    console.log('✓ Connected to database\n');

    console.log('🔧 Setting up test users...\n');

    for (const user of TEST_USERS) {
      // Get role ID
      const roleResult = await client.query(
        'SELECT id FROM roles WHERE slug = $1',
        [user.roleSlug]
      );

      if (roleResult.rows.length === 0) {
        console.log(`❌ Role not found: ${user.roleSlug}`);
        continue;
      }

      const roleId = roleResult.rows[0].id;

      // Check if user exists
      const existingUser = await client.query(
        'SELECT id FROM users WHERE id = $1',
        [user.id]
      );

      if (existingUser.rows.length > 0) {
        // Update existing user
        await client.query(
          'UPDATE users SET email = $1, name = $2, role_id = $3 WHERE id = $4',
          [user.email, user.name, roleId, user.id]
        );
        console.log(`✓ Updated ${user.roleSlug}: ${user.name} (${user.email})`);
      } else {
        // Create new user
        const hashedPassword = crypto
          .createHash('sha256')
          .update(user.password)
          .digest('hex');

        await client.query(
          `INSERT INTO users (id, email, name, password, role_id)
           VALUES ($1, $2, $3, $4, $5)`,
          [user.id, user.email, user.name, hashedPassword, roleId]
        );
        console.log(`✓ Created ${user.roleSlug}: ${user.name} (${user.email})`);
      }
    }

    console.log('\n✨ Test users setup complete!');
    console.log('\nTest Tokens:\n');

    TEST_USERS.forEach(user => {
      const token = jwt.sign(
        { id: user.id, email: user.email, role: user.roleSlug, name: user.name },
        JWT_SECRET
      );
      console.log(`${user.roleSlug.toUpperCase()}: ${token.substring(0, 50)}...`);
    });

  } catch (error) {
    console.error('❌ Setup Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

setupTestUsers().then(() => {
  process.exit(0);
}).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
