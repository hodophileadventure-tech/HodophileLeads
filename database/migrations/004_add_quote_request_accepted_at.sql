-- Track when a quotation is accepted so only one accepted quotation exists per lead
ALTER TABLE quote_requests ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMP;

COMMENT ON COLUMN quote_requests.accepted_at IS 'Timestamp of the accepted quotation for a lead';