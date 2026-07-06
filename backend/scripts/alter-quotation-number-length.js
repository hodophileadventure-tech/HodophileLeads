#!/usr/bin/env node
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  if (!process.env.DATABASE_URL) {
    console.error('No DATABASE_URL configured. Set DATABASE_URL and retry.');
    process.exit(1);
  }

  const client = await pool.connect();
  try {
    const res = await client.query(
      `SELECT character_maximum_length
       FROM information_schema.columns
       WHERE table_name = 'quote_requests' AND column_name = 'quotation_number' LIMIT 1`
    );

    const len = res.rows?.[0]?.character_maximum_length || null;
    console.log('Current quotation_number length:', len);

    if (len === null) {
      console.log('Column not found — nothing to do.');
      return;
    }

    if (len >= 255) {
      console.log('quotation_number already supports length >= 255 — no action required.');
      return;
    }

    console.log('Altering column to VARCHAR(255)...');
    await client.query('BEGIN');
    await client.query("ALTER TABLE quote_requests ALTER COLUMN quotation_number TYPE VARCHAR(255)");
    await client.query('COMMIT');
    console.log('✅ quotation_number column altered to VARCHAR(255)');
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    console.error('Failed to alter column:', err.message || err);
    process.exitCode = 2;
  } finally {
    client.release();
    await pool.end();
  }
}

run();
