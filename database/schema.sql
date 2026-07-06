-- Users Table
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
);

-- Leads Table
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
  adults INTEGER DEFAULT NULL,
  kids INTEGER DEFAULT NULL,
  seniors INTEGER DEFAULT NULL,
  tour_type VARCHAR(100),
  address TEXT,
  gender VARCHAR(20),
  age INTEGER,
  budget DECIMAL(12, 2) NOT NULL DEFAULT 0,
  trip_budget DECIMAL(12, 2),
  initial_price DECIMAL(12, 2),
  latest_revised_price DECIMAL(12, 2),
  actual_price DECIMAL(12, 2),
  source VARCHAR(100) NOT NULL,
  temperature VARCHAR(50) NOT NULL DEFAULT 'cold',
  status VARCHAR(50) NOT NULL DEFAULT 'new',
  lead_outcome VARCHAR(50),
  agent_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  notes TEXT,
  agent_remarks TEXT,
  remarks TEXT,
  potential BOOLEAN DEFAULT FALSE,
  special_requests TEXT,
  transport_preference VARCHAR(255),
  hotel_preference VARCHAR(255),
  islamabad_stay VARCHAR(10),
  canceled_reason TEXT,
  canceled_by UUID REFERENCES users(id),
  canceled_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT valid_temperature CHECK (temperature IN ('hot', 'warm', 'cold', 'dead')),
  CONSTRAINT valid_status CHECK (status IN ('new', 'contacted', 'interested', 'negotiation', 'booked', 'completed', 'canceled', 'spam')),
  CONSTRAINT valid_lead_outcome CHECK (lead_outcome IS NULL OR lead_outcome IN ('confirmed', 'budget_issue', 'no_reply'))
);

-- Follow-ups Table
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
  created_by UUID REFERENCES users(id),
  completed_at TIMESTAMP,
  canceled_reason TEXT,
  canceled_by UUID REFERENCES users(id),
  canceled_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT valid_type CHECK (type IN ('manual', 'auto')),
  CONSTRAINT valid_status CHECK (status IN ('overdue', 'today', 'upcoming', 'completed', 'canceled')),
  CONSTRAINT valid_priority CHECK (priority IN ('low', 'medium', 'high'))
);

-- Itineraries Table
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
);

-- Payments Table
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  amount DECIMAL(12, 2) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  method VARCHAR(50) NOT NULL,
  due_date TIMESTAMP NOT NULL,
  paid_date TIMESTAMP,
  notes TEXT,
  proof_url VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT valid_status CHECK (status IN ('pending', 'approved', 'confirmed', 'failed')),
  CONSTRAINT valid_method CHECK (method IN ('cash', 'card', 'bank_transfer'))
);

-- Triple-Lock Availability Table
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
);

-- Client Profiles Table
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
);

-- Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type VARCHAR(100) NOT NULL,
  entity_id UUID NOT NULL,
  action VARCHAR(100) NOT NULL,
  changes JSONB,
  user_id UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  type VARCHAR(100),
  message TEXT,
  payload JSONB,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Request quotes and invoices table
CREATE TABLE IF NOT EXISTS quote_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL REFERENCES users(id),
  request_type VARCHAR(50) NOT NULL CHECK (request_type IN ('quotation', 'invoice')),
  status VARCHAR(50) NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'manager_pending', 'admin_pending', 'approved', 'rejected', 'saved', 'invalid_for_acceptance')),
  document_data JSONB,
  created_by_manager UUID REFERENCES users(id),
  created_by_manager_at TIMESTAMP,
  manager_notes TEXT,
  resolved_by UUID REFERENCES users(id),
  resolved_at TIMESTAMP,
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMP,
  accepted_at TIMESTAMP,
  invalid_acceptance_reason TEXT,
  rejected_by UUID REFERENCES users(id),
  rejected_at TIMESTAMP,
  rejection_reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_quote_requests_lead_id ON quote_requests(lead_id);
CREATE INDEX idx_quote_requests_requested_by ON quote_requests(requested_by);
CREATE INDEX idx_quote_requests_status ON quote_requests(status);

-- Outbox events table for reliable cross-service delivery
CREATE TABLE IF NOT EXISTS outbox_events (
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
);

CREATE UNIQUE INDEX idx_outbox_events_external_id ON outbox_events(external_id) WHERE external_id IS NOT NULL;

-- Indexes for performance
CREATE INDEX idx_leads_agent_id ON leads(agent_id);
CREATE INDEX idx_leads_temperature ON leads(temperature);
CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_outcome ON leads(lead_outcome);
CREATE INDEX idx_leads_created_at ON leads(created_at DESC);
CREATE INDEX idx_follow_ups_lead_id ON follow_ups(lead_id);
CREATE INDEX idx_follow_ups_assigned_to ON follow_ups(assigned_to);
CREATE INDEX idx_follow_ups_created_by ON follow_ups(created_by);
CREATE INDEX idx_follow_ups_due_date ON follow_ups(due_date);
CREATE INDEX idx_payments_lead_id ON payments(lead_id);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);

-- Attachments Table
CREATE TABLE IF NOT EXISTS attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  file_name VARCHAR(500) NOT NULL,
  mime_type VARCHAR(200) NOT NULL,
  url VARCHAR(1000) NOT NULL,
  size BIGINT NOT NULL DEFAULT 0,
  uploaded_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_attachments_lead_id ON attachments(lead_id);

-- Screen Captures Table
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
);

CREATE INDEX idx_screen_captures_agent_id ON screen_captures(agent_id);
CREATE INDEX idx_screen_captures_expires_at ON screen_captures(expires_at);

-- Quotation Counters Table (for atomic, thread-safe quotation number generation)
CREATE TABLE IF NOT EXISTS quotation_counters (
  date_key VARCHAR(6) PRIMARY KEY,
  last_sequence INTEGER NOT NULL DEFAULT 1100,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add quotation_number column to quote_requests table
ALTER TABLE quote_requests ADD COLUMN IF NOT EXISTS quotation_number VARCHAR(255) UNIQUE;
