// ============================================================================
// MIGRATION RUNNER: Automatic schema migrations on startup
// ============================================================================

import fs from 'fs';
import path from 'path';
import { query } from './database';

interface Migration {
  filename: string;
  name: string;
  timestamp: string;
}

/**
 * Create migrations table if it doesn't exist
 */
async function createMigrationsTable(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) UNIQUE NOT NULL,
      executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

/**
 * Get list of already-executed migrations
 */
async function getExecutedMigrations(): Promise<Set<string>> {
  try {
    const result = await query('SELECT name FROM migrations ORDER BY executed_at');
    return new Set(result.rows.map((row: any) => row.name));
  } catch (err) {
    // Table might not exist yet, return empty set
    return new Set();
  }
}

/**
 * Get migration files from directory
 */
function getMigrationFiles(): Migration[] {
  // In production (Docker), this resolves to /app/database/migrations
  // In development, this resolves to backend/database/migrations
  const migrationsDir = path.join(__dirname, '..', '..', 'database', 'migrations');

  if (!fs.existsSync(migrationsDir)) {
    console.warn(`[Migration] Migrations directory not found: ${migrationsDir}`);
    return [];
  }

  const files = fs.readdirSync(migrationsDir)
    .filter(file => file.endsWith('.sql'))
    .sort(); // Sort alphabetically (timestamps ensure order)

  return files.map(filename => ({
    filename,
    name: filename.replace('.sql', ''),
    timestamp: filename.split('-').slice(0, 3).join('-') // Extract date part
  }));
}

/**
 * Read and execute a single migration file
 */
async function executeMigration(migrationPath: string, migrationName: string): Promise<void> {
  try {
    const sql = fs.readFileSync(migrationPath, 'utf8');

    // Split by ; and execute each statement
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    for (const statement of statements) {
      await query(statement);
    }

    // Record migration as executed
    await query(
      'INSERT INTO migrations (name) VALUES ($1) ON CONFLICT (name) DO NOTHING',
      [migrationName]
    );

    console.log(`[Migration] ✓ Executed: ${migrationName}`);
  } catch (error: any) {
    console.error(`[Migration] ✗ Failed to execute ${migrationName}:`, error.message);
    throw error;
  }
}

/**
 * Run all pending migrations
 */
export async function runMigrations(): Promise<void> {
  try {
    console.log('[Migration] Starting migration runner...');

    // Create migrations table
    await createMigrationsTable();

    // Get executed migrations
    const executed = await getExecutedMigrations();

    // Get migration files
    const migrations = getMigrationFiles();

    if (migrations.length === 0) {
      console.log('[Migration] No migration files found');
      return;
    }

    // Filter to pending migrations
    const pending = migrations.filter(m => !executed.has(m.name));

    if (pending.length === 0) {
      console.log('[Migration] ✓ All migrations already executed');
      return;
    }

    console.log(`[Migration] Found ${pending.length} pending migration(s)`);

    // Execute pending migrations
    const migrationsDir = path.join(__dirname, '..', '..', 'database', 'migrations');

    for (const migration of pending) {
      const migrationPath = path.join(migrationsDir, migration.filename);
      await executeMigration(migrationPath, migration.name);
    }

    console.log('[Migration] ✓ All pending migrations executed successfully');
  } catch (error) {
    console.error('[Migration] ✗ Migration runner failed:', error);
    throw error;
  }
}

/**
 * Get migration status (for debugging)
 */
export async function getMigrationStatus(): Promise<{
  executed: string[];
  pending: string[];
  total: number;
}> {
  try {
    const executed = await getExecutedMigrations();
    const migrations = getMigrationFiles();

    return {
      executed: Array.from(executed),
      pending: migrations.filter(m => !executed.has(m.name)).map(m => m.name),
      total: migrations.length
    };
  } catch (error) {
    throw new Error(`Failed to get migration status: ${error}`);
  }
}
