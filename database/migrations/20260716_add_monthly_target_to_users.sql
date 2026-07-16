-- Add monthly_target column to users for per-agent targets
ALTER TABLE users ADD COLUMN IF NOT EXISTS monthly_target NUMERIC(14,2) DEFAULT 5000000;
