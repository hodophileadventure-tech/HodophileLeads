DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'outbox_events_external_id_unique'
  ) THEN
    ALTER TABLE outbox_events ADD CONSTRAINT outbox_events_external_id_unique UNIQUE (external_id);
  END IF;
END
$$;