-- Add proof_url column to payments table for storing payment proof/receipt
ALTER TABLE payments ADD COLUMN IF NOT EXISTS proof_url VARCHAR(500);

-- Add comment to the column
COMMENT ON COLUMN payments.proof_url IS 'URL/path to the uploaded payment proof (screenshot, receipt, etc.)';
