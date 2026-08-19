ALTER TABLE follow_ups
ADD COLUMN IF NOT EXISTS completion_notes TEXT;
