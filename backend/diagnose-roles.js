/**
 * Diagnostic: Check Phase 2 roles and permissions setup
 */

const { Client } = require('pg');

const client = new Client({
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'tripnexus'
});

async function diagnose() {
  try {
    await client.connect();
    console.log('✓ Connected to database\n');

    // Check roles
    console.log('📋 Roles in database:');
    const rolesRes = await client.query('SELECT id, name, slug FROM roles');
    rolesRes.rows.forEach(r => {
      console.log(`  - ${r.slug}: ${r.name} (${r.id})`);
    });

    // Check permissions
    console.log('\n📋 Permissions in database:');
    const permsRes = await client.query(
      'SELECT resource, action, display_name FROM permissions ORDER BY resource, action'
    );
    const permsByResource = {};
    permsRes.rows.forEach(p => {
      if (!permsByResource[p.resource]) {
        permsByResource[p.resource] = [];
      }
      permsByResource[p.resource].push(p.action);
    });
    
    Object.entries(permsByResource).forEach(([resource, actions]) => {
      console.log(`  ${resource}: ${actions.join(', ')}`);
    });

    // Check role permissions
    console.log('\n📋 Role Permissions Assignments:');
    const rolePermsRes = await client.query(`
      SELECT r.slug, p.resource, p.action
      FROM role_permissions rp
      JOIN roles r ON rp.role_id = r.id
      JOIN permissions p ON rp.permission_id = p.id
      ORDER BY r.slug, p.resource, p.action
    `);

    const rolesMap = {};
    rolePermsRes.rows.forEach(rp => {
      if (!rolesMap[rp.slug]) {
        rolesMap[rp.slug] = [];
      }
      rolesMap[rp.slug].push(`${rp.resource}.${rp.action}`);
    });

    Object.entries(rolesMap).forEach(([role, perms]) => {
      console.log(`  ${role}:`);
      perms.slice(0, 10).forEach(p => {
        console.log(`    ✓ ${p}`);
      });
      if (perms.length > 10) {
        console.log(`    ... and ${perms.length - 10} more`);
      }
    });

    // Check test users
    console.log('\n👥 Test Users:');
    const usersRes = await client.query(`
      SELECT u.id, u.email, u.name, r.slug as role
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE u.email IN ('admin@test.com', 'agent@test.com', 'manager@test.com')
    `);

    usersRes.rows.forEach(u => {
      console.log(`  ${u.email}: ${u.name} (${u.role || 'NO ROLE'})`);
      console.log(`    ID: ${u.id}`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

diagnose();
