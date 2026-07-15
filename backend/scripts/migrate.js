require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const DEFAULT_ADMIN_EMAIL = 'admin@hodophile.com';
const DEFAULT_ADMIN_NAME = 'Admin User';
const DEFAULT_ADMIN_PASSWORD_HASH = '$2a$10$hbMKu.dCXAwpVBWqxFXAL.7SKl49B/IDXphos3pxT1FV/v8ASD4rW';
const DEFAULT_AGENT_EMAIL = 'sameer@hodophile.pk';
const DEFAULT_AGENT_NAME = 'Sameer';
const DEFAULT_AGENT_PASSWORD_HASH = '$2a$10$k3aJ97YjR8MXLB7AGogGGOoS9NO9Kd9xyiio0PbZNVh5gsCfaiXJ6';

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
        last_login_at TIMESTAMP,
        last_logout_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT valid_role CHECK (role IN ('admin', 'agent', 'manager'))
      )
    `);
    console.log('✅ Users table created');

    await client.query('ALTER TABLE users DROP CONSTRAINT IF EXISTS valid_role');
    await client.query("ALTER TABLE users ADD CONSTRAINT valid_role CHECK (role IN ('admin', 'agent', 'manager'))");
    await client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP');
    await client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS last_logout_at TIMESTAMP');
    console.log('✅ Users login audit columns ensured');

    await client.query(`
      INSERT INTO users (email, name, password, role)
      VALUES ($1, $2, $3, 'admin')
      ON CONFLICT (email) DO NOTHING
    `, [DEFAULT_ADMIN_EMAIL, DEFAULT_ADMIN_NAME, DEFAULT_ADMIN_PASSWORD_HASH]);
    console.log('✅ Default admin ensured');

    await client.query(`
      INSERT INTO users (email, name, password, role)
      VALUES ($1, $2, $3, 'agent')
      ON CONFLICT (email) DO NOTHING
    `, [DEFAULT_AGENT_EMAIL, DEFAULT_AGENT_NAME, DEFAULT_AGENT_PASSWORD_HASH]);
    console.log('✅ Default agent ensured');

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
        client_name VARCHAR(255),
        email VARCHAR(255),
        phone VARCHAR(20) NOT NULL,
        destination VARCHAR(255),
        destinations JSONB,
        travel_dates JSONB,
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
        tour_type VARCHAR(100),
        lead_outcome VARCHAR(50),
        agent_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        notes TEXT,
        agent_remarks TEXT,
        remarks TEXT,
        potential BOOLEAN DEFAULT FALSE,
        special_requests TEXT,
        transport_preference VARCHAR(255),
        hotel_preference VARCHAR(255),
        canceled_reason TEXT,
        canceled_by UUID REFERENCES users(id),
        canceled_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT valid_temperature CHECK (temperature IN ('hot', 'warm', 'cold', 'dead')),
        CONSTRAINT valid_status CHECK (status IN ('new', 'contacted', 'interested', 'negotiation', 'booked', 'completed', 'canceled', 'spam')),
        CONSTRAINT valid_lead_outcome CHECK (lead_outcome IS NULL OR lead_outcome IN ('confirmed', 'budget_issue', 'no_reply'))
      )
    `);
    console.log('✅ Leads table created');

    // Add missing columns if they don't exist (safely)
    const addColumnCommands = [
      'ALTER TABLE leads ADD COLUMN IF NOT EXISTS canceled_reason TEXT',
      'ALTER TABLE leads ADD COLUMN IF NOT EXISTS canceled_by UUID REFERENCES users(id)',
      'ALTER TABLE leads ADD COLUMN IF NOT EXISTS canceled_at TIMESTAMP',
      'ALTER TABLE leads ADD COLUMN IF NOT EXISTS lead_outcome VARCHAR(50)',
      'ALTER TABLE leads ADD COLUMN IF NOT EXISTS adults INTEGER',
      'ALTER TABLE leads ADD COLUMN IF NOT EXISTS kids INTEGER',
      'ALTER TABLE leads ADD COLUMN IF NOT EXISTS seniors INTEGER',
      'ALTER TABLE leads ADD COLUMN IF NOT EXISTS tour_type VARCHAR(100)',
      'ALTER TABLE leads ADD COLUMN IF NOT EXISTS islamabad_stay VARCHAR(10)',
      'ALTER TABLE leads ADD COLUMN IF NOT EXISTS pipeline_stage VARCHAR(50) NOT NULL DEFAULT \'new_lead\'',
      'ALTER TABLE leads ADD COLUMN IF NOT EXISTS status VARCHAR(50) NOT NULL DEFAULT \'new\'',
      'ALTER TABLE leads ADD COLUMN IF NOT EXISTS potential BOOLEAN DEFAULT FALSE'
    ];
    
    for (const cmd of addColumnCommands) {
      try {
        await client.query(cmd);
      } catch (err) {
        // Column might already exist - ignore
        if (err.code !== '42701') { // 42701 = duplicate column
          console.warn(`Warning: ${cmd} - ${err.message}`);
        }
      }
    }

    await client.query('ALTER TABLE leads DROP CONSTRAINT IF EXISTS valid_status');
    await client.query("ALTER TABLE leads ADD CONSTRAINT valid_status CHECK (status IN ('new', 'contacted', 'interested', 'negotiation', 'booked', 'completed', 'canceled', 'spam'))");
    console.log('✅ Leads status constraint ensured');
    console.log('✅ Lead cancel tracking columns ensured');

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
        canceled_reason TEXT,
        canceled_by UUID REFERENCES users(id),
        canceled_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT valid_type CHECK (type IN ('manual', 'auto')),
        CONSTRAINT valid_status CHECK (status IN ('overdue', 'today', 'upcoming', 'completed', 'canceled')),
        CONSTRAINT valid_priority CHECK (priority IN ('low', 'medium', 'high'))
      )
    `);
    console.log('✅ Follow-ups table created');

    await client.query("ALTER TABLE follow_ups ADD COLUMN IF NOT EXISTS type VARCHAR(50)");
    await client.query("ALTER TABLE follow_ups ADD COLUMN IF NOT EXISTS title VARCHAR(255)");
    await client.query("ALTER TABLE follow_ups ADD COLUMN IF NOT EXISTS description TEXT");
    await client.query("ALTER TABLE follow_ups ADD COLUMN IF NOT EXISTS due_date TIMESTAMP");
    await client.query("ALTER TABLE follow_ups ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'upcoming'");
    await client.query("ALTER TABLE follow_ups ADD COLUMN IF NOT EXISTS priority VARCHAR(50) DEFAULT 'medium'");
    await client.query("ALTER TABLE follow_ups ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES users(id)");
    await client.query('ALTER TABLE follow_ups ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP');
    await client.query('ALTER TABLE follow_ups ADD COLUMN IF NOT EXISTS canceled_reason TEXT');
    await client.query('ALTER TABLE follow_ups ADD COLUMN IF NOT EXISTS canceled_by UUID REFERENCES users(id)');
    await client.query('ALTER TABLE follow_ups ADD COLUMN IF NOT EXISTS canceled_at TIMESTAMP');
    console.log('✅ Follow-up cancel tracking columns ensured');

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

    // 9. Daily Reports Table (depends on users)
    await client.query(`
      CREATE TABLE IF NOT EXISTS daily_reports (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        report_type VARCHAR(20) NOT NULL CHECK (report_type IN ('daily', 'weekly', 'monthly')),
        report_date DATE NOT NULL,
        user_id UUID REFERENCES users(id),
        period_start DATE NOT NULL,
        period_end DATE NOT NULL,
        report_data JSONB NOT NULL,
        total_activities INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(report_type, report_date, user_id)
      )
    `);
    console.log('✅ Daily Reports table created');

    // 10. Notifications Table (depends on users, leads)
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

    // 10. Quote Requests Table (depends on leads, users)
    await client.query(`
      CREATE TABLE IF NOT EXISTS quote_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
        requested_by UUID NOT NULL REFERENCES users(id),
        request_type VARCHAR(50) NOT NULL CHECK (request_type IN ('quotation', 'invoice')),
        status VARCHAR(50) NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'manager_pending', 'admin_pending', 'approved', 'rejected', 'saved')),
        document_data JSONB,
        created_by_manager UUID REFERENCES users(id),
        created_by_manager_at TIMESTAMP,
        manager_notes TEXT,
        resolved_by UUID REFERENCES users(id),
        resolved_at TIMESTAMP,
        approved_by UUID REFERENCES users(id),
        approved_at TIMESTAMP,
        rejected_by UUID REFERENCES users(id),
        rejected_at TIMESTAMP,
        rejection_reason TEXT,
        re_request_notes TEXT,
        parent_request_id UUID REFERENCES quote_requests(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Add missing columns if they don't exist
    await client.query(`
      ALTER TABLE quote_requests 
      ADD COLUMN IF NOT EXISTS re_request_notes TEXT
    `);
    
    await client.query(`
      ALTER TABLE quote_requests 
      ADD COLUMN IF NOT EXISTS parent_request_id UUID REFERENCES quote_requests(id) ON DELETE SET NULL
    `);
    
    await client.query(`
      ALTER TABLE quote_requests 
      ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES users(id)
    `);
    
    await client.query(`
      ALTER TABLE quote_requests 
      ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP
    `);
    
    await client.query(`
      ALTER TABLE quote_requests 
      ADD COLUMN IF NOT EXISTS quotation_number VARCHAR(255) UNIQUE
    `);

    const quotationNumberLengthCheck = await client.query(`
      SELECT character_maximum_length
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'quote_requests'
        AND column_name = 'quotation_number'
      LIMIT 1
    `);
    const currentLength = quotationNumberLengthCheck.rows?.[0]?.character_maximum_length;
    if (typeof currentLength === 'number' && currentLength < 255) {
      console.log('[MIGRATION] Updating quotation_number column length to VARCHAR(255)...');
      await client.query(`ALTER TABLE quote_requests ALTER COLUMN quotation_number TYPE VARCHAR(255)`);
      console.log('[MIGRATION] ✅ quotation_number column altered to VARCHAR(255)');
    }

    const outboxTableCheck = await client.query(`
      SELECT COUNT(*) as count FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'outbox_events'
    `);
    const outboxTableExists = outboxTableCheck.rows?.[0]?.count > 0;
    if (!outboxTableExists) {
      console.log('✅ Creating outbox_events table...');
      await client.query(`
        CREATE TABLE outbox_events (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          external_id VARCHAR(255),
          event_type VARCHAR(100) NOT NULL,
          payload JSONB NOT NULL,
          status VARCHAR(50) NOT NULL DEFAULT 'pending',
          retry_count INTEGER NOT NULL DEFAULT 0,
          last_error TEXT,
          next_attempt_at TIMESTAMP NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT valid_outbox_status CHECK (status IN ('pending', 'processing', 'completed', 'failed'))
        )
      `);
      await client.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_outbox_events_external_id ON outbox_events(external_id) WHERE external_id IS NOT NULL
      `);
      console.log('✅ outbox_events table created successfully');
    }

    // Add approval workflow columns
    await client.query(`
      ALTER TABLE quote_requests 
      ADD COLUMN IF NOT EXISTS created_by_manager UUID REFERENCES users(id)
    `);
    
    await client.query(`
      ALTER TABLE quote_requests 
      ADD COLUMN IF NOT EXISTS created_by_manager_at TIMESTAMP
    `);
    
    await client.query(`
      ALTER TABLE quote_requests 
      ADD COLUMN IF NOT EXISTS manager_notes TEXT
    `);
    
    await client.query(`
      ALTER TABLE quote_requests 
      ADD COLUMN IF NOT EXISTS rejected_by UUID REFERENCES users(id)
    `);
    
    await client.query(`
      ALTER TABLE quote_requests 
      ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMP
    `);
    
    await client.query(`
      ALTER TABLE quote_requests 
      ADD COLUMN IF NOT EXISTS rejection_reason TEXT
    `);
    
    // Create quotation counter table for thread-safe number generation
    await client.query(`
      CREATE TABLE IF NOT EXISTS quotation_counters (
        date_key VARCHAR(8) PRIMARY KEY,
        last_sequence INTEGER NOT NULL DEFAULT 1100,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    console.log('✅ Quote Requests table created');

    // 11. Attachments Table (depends on leads, users)
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

    // 11. Screen Captures Table (depends on users)
    await client.query(`
      CREATE TABLE IF NOT EXISTS screen_captures (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        request_id UUID NOT NULL,
        agent_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        requested_by UUID REFERENCES users(id),
        file_name VARCHAR(500) NOT NULL,
        mime_type VARCHAR(200) NOT NULL,
        url VARCHAR(1000) NOT NULL,
        size BIGINT NOT NULL DEFAULT 0,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Screen Captures table created');

    // 12. Issues Table (for bug/issue reports)
    await client.query(`
      CREATE TABLE IF NOT EXISTS issues (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        location VARCHAR(255),
        description TEXT,
        reporter_role VARCHAR(50),
        reporter_id UUID REFERENCES users(id),
        status VARCHAR(50) NOT NULL DEFAULT 'open',
        attachment_url VARCHAR(1000),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Issues table created');

    // 13. Hotels Tables (for Hotel Directory feature)
    await client.query(`
      CREATE TABLE IF NOT EXISTS hotels (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        city VARCHAR(100) NOT NULL,
        location VARCHAR(255),
        contact_phone VARCHAR(50),
        contact_email VARCHAR(255),
        description TEXT,
        rating DECIMAL(3,1),
        amenities TEXT[],
        image_url VARCHAR(500),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Hotels table created');

    await client.query(`
      CREATE TABLE IF NOT EXISTS room_types (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        hotel_id UUID NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        capacity INTEGER NOT NULL DEFAULT 2,
        amenities TEXT[],
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Room Types table created');

    await client.query(`
      CREATE TABLE IF NOT EXISTS room_pricing (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        room_type_id UUID NOT NULL REFERENCES room_types(id) ON DELETE CASCADE,
        occupancy_type VARCHAR(50),
        season_name VARCHAR(50),
        season_start_date DATE,
        season_end_date DATE,
        price_pkr DECIMAL(10,2),
        price_range_min DECIMAL(10,2),
        price_range_max DECIMAL(10,2),
        extra_services JSONB,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Room Pricing table created');

    // 13a. Fix existing lead temperatures - update old auto-calculated 'dead' leads to 'warm'
    await client.query(`
      UPDATE leads
      SET temperature = 'warm'
      WHERE temperature = 'dead' 
        AND status NOT IN ('completed', 'canceled')
    `);
    console.log('✅ Lead temperatures fixed - reverted auto-dead leads to warm');

    // 14. Create Indexes for performance
    const indexQueries = [
      'CREATE INDEX IF NOT EXISTS idx_leads_agent_id ON leads(agent_id)',
      'CREATE INDEX IF NOT EXISTS idx_leads_temperature ON leads(temperature)',
      'CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status)',
      'CREATE INDEX IF NOT EXISTS idx_leads_outcome ON leads(lead_outcome)',
      'CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at DESC)',
      'CREATE INDEX IF NOT EXISTS idx_follow_ups_lead_id ON follow_ups(lead_id)',
      'CREATE INDEX IF NOT EXISTS idx_follow_ups_assigned_to ON follow_ups(assigned_to)',
      'CREATE INDEX IF NOT EXISTS idx_follow_ups_due_date ON follow_ups(due_date)',
      'CREATE INDEX IF NOT EXISTS idx_payments_lead_id ON payments(lead_id)',
      'CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id)',
      'CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_notifications_lead_id ON notifications(lead_id)',
      'CREATE INDEX IF NOT EXISTS idx_quote_requests_lead_id ON quote_requests(lead_id)',
      'CREATE INDEX IF NOT EXISTS idx_quote_requests_requested_by ON quote_requests(requested_by)',
      'CREATE INDEX IF NOT EXISTS idx_quote_requests_status ON quote_requests(status)',
      'CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)',
      'CREATE INDEX IF NOT EXISTS idx_client_profiles_phone ON client_profiles(phone)',
      'CREATE INDEX IF NOT EXISTS idx_screen_captures_agent_id ON screen_captures(agent_id)',
      'CREATE INDEX IF NOT EXISTS idx_screen_captures_expires_at ON screen_captures(expires_at)',
      'CREATE INDEX IF NOT EXISTS idx_issues_created_at ON issues(created_at DESC)',
      'CREATE INDEX IF NOT EXISTS idx_hotels_city ON hotels(city)',
      'CREATE INDEX IF NOT EXISTS idx_hotels_is_active ON hotels(is_active)',
      'CREATE INDEX IF NOT EXISTS idx_room_types_hotel_id ON room_types(hotel_id)',
      'CREATE INDEX IF NOT EXISTS idx_room_types_is_active ON room_types(is_active)',
      'CREATE INDEX IF NOT EXISTS idx_room_pricing_room_type_id ON room_pricing(room_type_id)',
      'CREATE INDEX IF NOT EXISTS idx_room_pricing_is_active ON room_pricing(is_active)'
    ];

    for (const query of indexQueries) {
      await client.query(query);
    }
    console.log('✅ All indexes created');

    await client.query('COMMIT');
    const tables = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    const columns = await client.query(`
      SELECT table_name, column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
      ORDER BY table_name, ordinal_position
    `);

    const columnsByTable = new Map();
    for (const row of columns.rows) {
      const current = columnsByTable.get(row.table_name) || [];
      current.push(row);
      columnsByTable.set(row.table_name, current);
    }

    console.log('\n📋 Database schema summary');
    console.log(`Tables created: ${tables.rows.length}`);
    for (const table of tables.rows) {
      const tableColumns = columnsByTable.get(table.table_name) || [];
      const columnList = tableColumns.map((col) => `${col.column_name}:${col.data_type}${col.is_nullable === 'NO' ? '!' : ''}`).join(', ');
      console.log(`- ${table.table_name} (${tableColumns.length} columns): ${columnList}`);
    }

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
