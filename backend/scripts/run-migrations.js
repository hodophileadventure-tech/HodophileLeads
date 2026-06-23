#!/usr/bin/env node

/**
 * Run pending database migrations
 * Usage: node run-migrations.js
 * 
 * Reads all .sql files from database/migrations/ and executes them in order
 */

require('dotenv').config({ path: '../.env' });
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function runMigrations() {
  const client = await pool.connect();
  try {
    console.log('🔄 Starting database migrations...');
    
    // Read all migration files from database/migrations directory
    const migrationsDir = path.join(__dirname, '..', 'database', 'migrations');
    if (!fs.existsSync(migrationsDir)) {
      console.log('ℹ️ No migrations directory found');
      return;
    }

    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    if (files.length === 0) {
      console.log('ℹ️ No migration files found');
      return;
    }

    for (const file of files) {
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf-8');
      
      console.log(`⏳ Running migration: ${file}`);
      try {
        await client.query(sql);
        console.log(`✅ Migration completed: ${file}`);
      } catch (error) {
        if (error.code === '42703') {
          // Column already exists
          console.log(`ℹ️ Migration skipped (column already exists): ${file}`);
        } else {
          throw error;
        }
      }
    }

    console.log('✅ All migrations completed!');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await client.end();
    process.exit(0);
  }
}

runMigrations();
