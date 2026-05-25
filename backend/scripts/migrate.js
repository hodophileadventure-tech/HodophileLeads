require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('🔄 Starting database migration...');
    await client.query('BEGIN');

    // 1. Users Table (no dependencies)
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'agent',
        avatar_url VARCHAR(500),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT valid_role CHECK (role IN ('admin', 'agent'))
      )
    `);
    console.log('✅ Users table created');

    // 2. Client Profiles Table (no dependencies)
    await client.query(`
      CREATE TABLE IF NOT EXISTS client_profiles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        phone VARCHAR(50) UNIQUE NOT NULL,
        name VARCHAR(255),
        email VARCHAR(255),
        address TEXT,
        gender VARCHAR(20),
        age INTEGER,
        loyalty_tier VARCHAR(50) DEFAULT 'bronze',
        total_trips INTEGER DEFAULT 0,
        preferred_destinations TEXT,
        special_requirements TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Client Profiles table created');

    // 3. Leads Table (depends on users, client_profiles)
    await client.query(`
      CREATE TABLE IF NOT EXISTS leads (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        client_name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        phone VARCHAR(20) NOT NULL,
        destination VARCHAR(255) NOT NULL,
        destinations JSONB,
        travel_dates JSONB NOT NULL,
        hotel_info JSONB,
        hotel_options JSONB,
        profile_id UUID REFERENCES client_profiles(id),
        persons INTEGER NOT NULL DEFAULT 1,
        address TEXT,
        gender VARCHAR(20),
        age INTEGER,
        budget DECIMAL(12, 2) NOT NULL DEFAULT 0,
        source VARCHAR(100) NOT NULL,
        temperature VARCHAR(50) NOT NULL DEFAULT 'cold',
        status VARCHAR(50) NOT NULL DEFAULT 'new',
        agent_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        notes TEXT,
        agent_remarks TEXT,
        remarks TEXT,
        potential BOOLEAN DEFAULT FALSE,
        special_requests TEXT,
        transport_preference VARCHAR(255),
        hotel_preference VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT valid_temperature CHECK (temperature IN ('hot', 'warm', 'cold', 'dead')),
        CONSTRAINT valid_status CHECK (status IN ('new', 'contacted', 'interested', 'negotiation', 'booked', 'completed'))
      )
    `);
    console.log('✅ Leads table created');

    // 4. Follow-ups Table (depends on leads, users)
    await client.query(`
      CREATE TABLE IF NOT EXISTS follow_ups (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        due_date TIMESTAMP NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'upcoming',
        priority VARCHAR(50) NOT NULL DEFAULT 'medium',
        assigned_to UUID NOT NULL REFERENCES users(id),
        completed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT valid_type CHECK (type IN ('manual', 'auto')),
        CONSTRAINT valid_status CHECK (status IN ('overdue', 'today', 'upcoming', 'completed')),
        CONSTRAINT valid_priority CHECK (priority IN ('low', 'medium', 'high'))
      )
    `);
    console.log('✅ Follow-ups table created');

    // 5. Itineraries Table (depends on leads)
    await client.query(`
      CREATE TABLE IF NOT EXISTS itineraries (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        lead_id UUID NOT NULL UNIQUE REFERENCES leads(id) ON DELETE CASCADE,
        trip_plan JSONB NOT NULL DEFAULT '[]',
        hotel_info JSONB,
        transport_info JSONB,
        guide_info JSONB,
        total_cost DECIMAL(12, 2) NOT NULL DEFAULT 0,
        status VARCHAR(50) NOT NULL DEFAULT 'draft',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT valid_status CHECK (status IN ('draft', 'approved', 'shared', 'finalized'))
      )
    `);
    console.log('✅ Itineraries table created');

    // 6. Payments Table (depends on leads)
    await client.query(`
      CREATE TABLE IF NOT EXISTS payments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
        amount DECIMAL(12, 2) NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'pending',
        method VARCHAR(50) NOT NULL,
        due_date TIMESTAMP NOT NULL,
        paid_date TIMESTAMP,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT valid_status CHECK (status IN ('pending', 'approved', 'confirmed', 'failed')),
        CONSTRAINT valid_method CHECK (method IN ('cash', 'card', 'bank_transfer'))
      )
    `);
    console.log('✅ Payments table created');

    // 7. Availability Table (depends on leads)
    await client.query(`
      CREATE TABLE IF NOT EXISTS availability (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        lead_id UUID NOT NULL UNIQUE REFERENCES leads(id) ON DELETE CASCADE,
        hotel_confirmed BOOLEAN DEFAULT FALSE,
        hotel_hold_expiry TIMESTAMP,
        transport_confirmed BOOLEAN DEFAULT FALSE,
        guide_confirmed BOOLEAN DEFAULT FALSE,
        all_confirmed BOOLEAN GENERATED ALWAYS AS (hotel_confirmed AND transport_confirmed AND guide_confirmed) STORED,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Availability table created');

    // 8. Audit Logs Table (depends on users)
    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        entity_type VARCHAR(100) NOT NULL,
        entity_id UUID NOT NULL,
        action VARCHAR(100) NOT NULL,
        changes JSONB,
        user_id UUID REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Audit Logs table created');

    // 9. Notifications Table (depends on users, leads)
    await client.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id),
        lead_id UUID REFERENCES leads(id),
        type VARCHAR(100),
        message TEXT,
        payload JSONB,
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Notifications table created');

    // 10. Attachments Table (depends on leads, users)
    await client.query(`
      CREATE TABLE IF NOT EXISTS attachments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
        file_name VARCHAR(500) NOT NULL,
        mime_type VARCHAR(200) NOT NULL,
        url VARCHAR(1000) NOT NULL,
        size BIGINT NOT NULL DEFAULT 0,
        uploaded_by UUID REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Attachments table created');

    // 11. Create Indexes for performance
    const indexQueries = [
      'CREATE INDEX IF NOT EXISTS idx_leads_agent_id ON leads(agent_id)',
      'CREATE INDEX IF NOT EXISTS idx_leads_temperature ON leads(temperature)',
      'CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status)',
      'CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at DESC)',
      'CREATE INDEX IF NOT EXISTS idx_follow_ups_lead_id ON follow_ups(lead_id)',
      'CREATE INDEX IF NOT EXISTS idx_follow_ups_assigned_to ON follow_ups(assigned_to)',
      'CREATE INDEX IF NOT EXISTS idx_follow_ups_due_date ON follow_ups(due_date)',
      'CREATE INDEX IF NOT EXISTS idx_payments_lead_id ON payments(lead_id)',
      'CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id)',
      'CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)',
      'CREATE INDEX IF NOT EXISTS idx_client_profiles_phone ON client_profiles(phone)'
    ];

    for (const query of indexQueries) {
      await client.query(query);
    }
    console.log('✅ All indexes created');

    await client.query('COMMIT');
    console.log('\n✅ ✅ ✅ Database migration completed successfully! All tables and indexes created.');
    process.exit(0);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', error.message);
    console.error('Details:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
