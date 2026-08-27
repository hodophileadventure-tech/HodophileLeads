BEGIN;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS working_days VARCHAR(20) NOT NULL DEFAULT 'monday-friday',
  ADD COLUMN IF NOT EXISTS reporting_time TIME NOT NULL DEFAULT '09:00';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_working_days_check'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_working_days_check
      CHECK (working_days IN ('monday-friday', 'monday-saturday'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS attendance_sheets (
  attendance_date DATE PRIMARY KEY,
  locked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  locked_by UUID REFERENCES users(id) ON DELETE SET NULL
);

COMMIT;