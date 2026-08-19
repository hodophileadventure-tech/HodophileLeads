ALTER TABLE follow_ups
ADD COLUMN IF NOT EXISTS completion_notes TEXT;

ALTER TABLE follow_ups
ADD COLUMN IF NOT EXISTS action_plan TEXT;
