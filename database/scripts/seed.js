import pg from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(process.cwd(), 'backend', '.env') });

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL
});

const runSeed = async () => {
  console.log('🌱 Starting database seed...');
  
  try {
    const seedPath = path.join(process.cwd(), 'database', 'seed-data.sql');
    const seedData = fs.readFileSync(seedPath, 'utf-8');
    
    const statements = seedData.split(';').filter(s => s.trim());
    
    for (const statement of statements) {
      if (statement.trim()) {
        await pool.query(statement);
        console.log('✓ Executed seed statement');
      }
    }
    
    console.log('✅ Seed completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
};

runSeed();
