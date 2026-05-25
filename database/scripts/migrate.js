import { query } from '../utils/database';
import * as fs from 'fs';
import * as path from 'path';

const runMigrations = async () => {
  console.log('🔄 Starting database migrations...');
  
  try {
    const schemaPath = path.join(process.cwd(), 'database', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    
    // Split SQL into statements and execute
    const statements = schema.split(';').filter(s => s.trim());
    
    for (const statement of statements) {
      if (statement.trim()) {
        await query(statement);
        console.log('✓ Executed migration');
      }
    }
    
    console.log('✅ Migrations completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
};

runMigrations();
