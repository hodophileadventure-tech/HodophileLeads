CREATE TABLE IF NOT EXISTS meta_lead_webhook_events (
  meta_lead_id VARCHAR(100) PRIMARY KEY,
  page_id VARCHAR(100) NOT NULL,
  form_id VARCHAR(100),
  platform VARCHAR(20),
  lead_payload JSONB,
  status VARCHAR(16) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  retry_count INTEGER NOT NULL DEFAULT 0 CHECK (retry_count >= 0),
  last_error TEXT,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_meta_lead_webhook_events_ready
  ON meta_lead_webhook_events (next_attempt_at, created_at)
  WHERE status IN ('pending', 'processing');
