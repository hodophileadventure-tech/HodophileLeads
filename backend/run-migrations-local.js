/**
 * Run Phase 2 Migrations Locally
 * Executes all migration files in database/migrations directory
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const client = new Client({
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'tripnexus'
});

async function runMigrations() {
  try {
    await client.connect();
    console.log('✓ Connected to database\n');

    // Create migrations table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✓ Migrations table initialized\n');

    // Get migration files
    const migrationsDir = path.join(__dirname, '..', 'database', 'migrations');
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    console.log(`Found ${files.length} migration(s)\n`);

    for (const file of files) {
      const migrationName = file.replace('.sql', '');
      
      // Check if migration already executed
      const result = await client.query(
        'SELECT name FROM migrations WHERE name = $1',
        [migrationName]
      );

      if (result.rows.length > 0) {
        console.log(`⊘ Skipping (already executed): ${migrationName}`);
        continue;
      }

      // Read and execute migration
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf8');

      try {
        await client.query(sql);
        
        // Record migration
        await client.query(
          'INSERT INTO migrations (name) VALUES ($1)',
          [migrationName]
        );
        
        console.log(`✓ Executed: ${migrationName}`);
      } catch (error) {
        console.error(`✗ Failed: ${migrationName}`);
        console.error(`  Error: ${error.message}\n`);
        // Continue with next migration despite error
      }
    }

    console.log('\n✨ Migration run complete!');
    
  } catch (error) {
    console.error('❌ Fatal Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigrations();
