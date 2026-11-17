CREATE TABLE IF NOT EXISTS meta_lead_assignment_state (
  assignment_key VARCHAR(100) PRIMARY KEY,
  last_agent_id UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
