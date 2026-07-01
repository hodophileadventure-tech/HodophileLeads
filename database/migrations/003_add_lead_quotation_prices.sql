-- Add quotation-linked pricing columns to leads
ALTER TABLE leads ADD COLUMN IF NOT EXISTS initial_price DECIMAL(12, 2);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS latest_revised_price DECIMAL(12, 2);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS actual_price DECIMAL(12, 2);

COMMENT ON COLUMN leads.initial_price IS 'Initial quotation subtotal captured from the first quotation';
COMMENT ON COLUMN leads.latest_revised_price IS 'Most recent quotation subtotal captured from the latest quotation revision';
COMMENT ON COLUMN leads.actual_price IS 'Accepted quotation price used for payment calculations';