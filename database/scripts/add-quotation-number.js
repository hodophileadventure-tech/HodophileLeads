const { query } = require('../utils/database');

async function migrateQuotationNumber() {
  try {
    console.log('Starting migration: adding quotation_number to quote_requests...');
    
    // Add quotation_number column if it doesn't exist
    await query(`
      ALTER TABLE quote_requests
      ADD COLUMN IF NOT EXISTS quotation_number VARCHAR(20) UNIQUE;
    `);
    
    console.log('✓ Column added successfully');
  } catch (error) {
    console.error('Migration failed:', error.message);
    throw error;
  }
}

migrateQuotationNumber();
