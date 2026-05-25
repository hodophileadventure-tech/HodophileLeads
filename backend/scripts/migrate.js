require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function migrate() {
  try {
    console.log('🔄 Starting database migration...');
    
    const schema = `
      -- Users table
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'agent',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      -- Client profiles table
      CREATE TABLE IF NOT EXISTS client_profiles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        phone VARCHAR(20) UNIQUE NOT NULL,
        name VARCHAR(255),
        email VARCHAR(255),
        address TEXT,
        gender VARCHAR(50),
        age INT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      -- Leads table
      CREATE TABLE IF NOT EXISTS leads (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255),
        phone VARCHAR(20),
        source VARCHAR(100),
        destination VARCHAR(100),
        destinations JSONB,
        status VARCHAR(50) DEFAULT 'new',
        temperature INT DEFAULT 50,
        budget DECIMAL(12, 2),
        travel_date DATE,
        hotel_info JSONB,
        hotel_options JSONB,
        agent_id UUID REFERENCES users(id),
        profile_id UUID REFERENCES client_profiles(id),
        address TEXT,
        gender VARCHAR(50),
        age INT,
        agent_remarks TEXT,
        remarks TEXT,
        potential BOOLEAN DEFAULT FALSE,
        special_requests TEXT,
        transport_preference VARCHAR(100),
        hotel_preference VARCHAR(100),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      -- Follow-ups table
      CREATE TABLE IF NOT EXISTS follow_ups (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
        assigned_to UUID REFERENCES users(id),
        task_type VARCHAR(100),
        due_date TIMESTAMP,
        status VARCHAR(50) DEFAULT 'pending',
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      -- Itineraries table
      CREATE TABLE IF NOT EXISTS itineraries (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
        title VARCHAR(255),
        description TEXT,
        days INT,
        cost DECIMAL(12, 2),
        status VARCHAR(50) DEFAULT 'draft',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      -- Payments table
      CREATE TABLE IF NOT EXISTS payments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
        amount DECIMAL(12, 2) NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        method VARCHAR(50) NOT NULL,
        due_date TIMESTAMP NOT NULL,
        paid_date TIMESTAMP,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        CONSTRAINT valid_payment_status CHECK (status IN ('pending', 'approved', 'confirmed', 'failed')),
        CONSTRAINT valid_payment_method CHECK (method IN ('cash', 'card', 'bank_transfer'))
      );

      -- Availability table
      CREATE TABLE IF NOT EXISTS availability (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
        hotel_confirmed BOOLEAN DEFAULT FALSE,
        flight_confirmed BOOLEAN DEFAULT FALSE,
        activity_confirmed BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      -- Audit logs table
      CREATE TABLE IF NOT EXISTS audit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id),
        action VARCHAR(255),
        entity_type VARCHAR(100),
        entity_id UUID,
        changes JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      );

      -- Notifications table
      CREATE TABLE IF NOT EXISTS notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id),
        lead_id UUID REFERENCES leads(id),
        type VARCHAR(100),
        message TEXT,
        payload JSONB,
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW()
      );

      -- Attachments table
      CREATE TABLE IF NOT EXISTS attachments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
        file_name VARCHAR(500) NOT NULL,
        mime_type VARCHAR(200) NOT NULL,
        url VARCHAR(1000) NOT NULL,
        size BIGINT NOT NULL DEFAULT 0,
        uploaded_by UUID REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `;

    const alterSchema = `
      ALTER TABLE leads ADD COLUMN IF NOT EXISTS agent_id UUID REFERENCES users(id);
      ALTER TABLE leads ADD COLUMN IF NOT EXISTS profile_id UUID REFERENCES client_profiles(id);
      ALTER TABLE leads ADD COLUMN IF NOT EXISTS address TEXT;
      ALTER TABLE leads ADD COLUMN IF NOT EXISTS gender VARCHAR(50);
      ALTER TABLE leads ADD COLUMN IF NOT EXISTS age INT;
      ALTER TABLE leads ADD COLUMN IF NOT EXISTS agent_remarks TEXT;
      ALTER TABLE leads ADD COLUMN IF NOT EXISTS remarks TEXT;
      ALTER TABLE leads ADD COLUMN IF NOT EXISTS potential BOOLEAN DEFAULT FALSE;
      ALTER TABLE leads ADD COLUMN IF NOT EXISTS special_requests TEXT;
      ALTER TABLE leads ADD COLUMN IF NOT EXISTS transport_preference VARCHAR(100);
      ALTER TABLE leads ADD COLUMN IF NOT EXISTS hotel_preference VARCHAR(100);
      ALTER TABLE client_profiles ADD COLUMN IF NOT EXISTS phone VARCHAR(20) UNIQUE NOT NULL;
      ALTER TABLE client_profiles ADD COLUMN IF NOT EXISTS name VARCHAR(255);
      ALTER TABLE client_profiles ADD COLUMN IF NOT EXISTS email VARCHAR(255);
      ALTER TABLE client_profiles ADD COLUMN IF NOT EXISTS address TEXT;
      ALTER TABLE client_profiles ADD COLUMN IF NOT EXISTS gender VARCHAR(50);
      ALTER TABLE client_profiles ADD COLUMN IF NOT EXISTS age INT;
    `;

    await pool.query(schema + alterSchema);
    console.log('✅ Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
