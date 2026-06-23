-- Add trip_budget column to leads table
ALTER TABLE leads ADD COLUMN IF NOT EXISTS trip_budget DECIMAL(12, 2);

-- Add comment to the column
COMMENT ON COLUMN leads.trip_budget IS 'Total budget allocated for the trip';
