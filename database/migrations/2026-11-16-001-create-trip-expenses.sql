CREATE TABLE IF NOT EXISTS lead_trip_expenses (
  lead_id UUID PRIMARY KEY REFERENCES leads(id) ON DELETE CASCADE,
  hotel_cost NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (hotel_cost >= 0),
  transport_cost NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (transport_cost >= 0),
  fuel_cost NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (fuel_cost >= 0),
  toll_taxes_cost NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (toll_taxes_cost >= 0),
  parking_cost NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (parking_cost >= 0),
  food_cost NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (food_cost >= 0),
  tour_guide_cost NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (tour_guide_cost >= 0),
  other_cost NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (other_cost >= 0),
  other_expense_note VARCHAR(500) NOT NULL DEFAULT '',
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);