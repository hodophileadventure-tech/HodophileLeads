-- Hotels Table
CREATE TABLE IF NOT EXISTS hotels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  city VARCHAR(100) NOT NULL,
  location VARCHAR(500),
  contact_phone VARCHAR(20),
  contact_email VARCHAR(255),
  description TEXT,
  rating DECIMAL(2,1),
  amenities TEXT[],
  image_url VARCHAR(500),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Room Types Table
CREATE TABLE IF NOT EXISTS room_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id UUID NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  capacity INTEGER DEFAULT 2,
  amenities TEXT[],
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Room Pricing Table (handles seasonal and occupancy-based pricing)
CREATE TABLE IF NOT EXISTS room_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_type_id UUID NOT NULL REFERENCES room_types(id) ON DELETE CASCADE,
  occupancy_type VARCHAR(50), -- e.g., 'single', 'double', 'triple', 'quad', or NULL for fixed price
  season_name VARCHAR(50), -- e.g., 'peak', 'blossom', 'low', 'high', 'off', or NULL for fixed price
  season_start_date VARCHAR(6), -- MMDD format for recurring seasons, or NULL
  season_end_date VARCHAR(6), -- MMDD format for recurring seasons, or NULL
  price_pkr INTEGER NOT NULL,
  price_range_min INTEGER, -- for price ranges
  price_range_max INTEGER, -- for price ranges
  extra_services JSONB, -- e.g., {"extra_mattress": 1500, "heating": 2500}
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_hotels_city ON hotels(city);
CREATE INDEX idx_hotels_is_active ON hotels(is_active);
CREATE INDEX idx_room_types_hotel_id ON room_types(hotel_id);
CREATE INDEX idx_room_types_is_active ON room_types(is_active);
CREATE INDEX idx_room_pricing_room_type_id ON room_pricing(room_type_id);
CREATE INDEX idx_room_pricing_is_active ON room_pricing(is_active);
