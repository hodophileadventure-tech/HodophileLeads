# Hotel Directory Feature

## Overview
The Hotel Directory is a comprehensive management system for hotels, room types, and pricing. It's available to Admin and Manager roles through a dedicated section in the application.

## Features

### 1. **Hotel Management**
- View all hotels organized by city
- Filter hotels by location
- Search hotels by name or location
- View hotel details including contact information and ratings

### 2. **Room Type Management**
- View all room types for each hotel
- See room capacity and amenities
- Track room descriptions and features

### 3. **Pricing Management**
- **Fixed Pricing**: Simple per-room pricing
- **Occupancy-Based Pricing**: Different prices for single, double, triple, quad occupancy
- **Seasonal Pricing**: Prices vary by season (peak, low, high, off-season, blossom)
- **Price Ranges**: Support for flexible pricing ranges
- **Extra Services**: Track additional services like extra mattresses, heating, etc.

### 4. **Statistics Dashboard**
- Total number of hotels
- Total cities covered
- Total room types available
- Hotels per city breakdown

## Database Schema

### Hotels Table
```sql
CREATE TABLE hotels (
  id UUID PRIMARY KEY,
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
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### Room Types Table
```sql
CREATE TABLE room_types (
  id UUID PRIMARY KEY,
  hotel_id UUID REFERENCES hotels(id),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  capacity INTEGER DEFAULT 2,
  amenities TEXT[],
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### Room Pricing Table
```sql
CREATE TABLE room_pricing (
  id UUID PRIMARY KEY,
  room_type_id UUID REFERENCES room_types(id),
  occupancy_type VARCHAR(50), -- 'single', 'double', 'triple', 'quad'
  season_name VARCHAR(50), -- 'peak', 'low', 'high', 'off', 'blossom'
  season_start_date VARCHAR(6), -- MMDD format
  season_end_date VARCHAR(6), -- MMDD format
  price_pkr INTEGER,
  price_range_min INTEGER,
  price_range_max INTEGER,
  extra_services JSONB, -- {"extra_mattress": 1500, "heating": 2500}
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

## API Endpoints

### Public Endpoints (All Authenticated Users)
- `GET /api/hotels` - Get all hotels
- `GET /api/hotels/cities` - Get list of all cities
- `GET /api/hotels/city/:city` - Get hotels in a specific city
- `GET /api/hotels/:hotelId` - Get detailed info for a specific hotel
- `GET /api/hotels/stats` - Get hotel statistics
- `GET /api/hotels/paginated` - Get hotels with pagination

### Admin/Manager Only Endpoints
- `POST /api/hotels` - Create a new hotel
- `POST /api/hotels/:hotelId/rooms` - Add room type to a hotel
- `POST /api/hotels/rooms/:roomTypeId/pricing` - Add pricing for a room type

## Frontend API Service

```typescript
import { hotelsAPI } from '@/utils/api-service';

// Get all hotels
const response = await hotelsAPI.getAll();

// Get hotels in a city
const response = await hotelsAPI.getByCity('Hunza');

// Get detailed info
const response = await hotelsAPI.getDetails(hotelId);

// Get statistics
const stats = await hotelsAPI.getStats();

// Create new hotel (admin/manager only)
const response = await hotelsAPI.create({
  name: 'My Hotel',
  city: 'Hunza',
  contact_phone: '+92-...',
  contact_email: 'info@hotel.com'
});
```

## Component Usage

The HotelsPanel component handles all hotel directory functionality:

```tsx
import { HotelsPanel } from '@/components/HotelsPanel';

function App() {
  return <HotelsPanel />;
}
```

## Data Import

### Importing Hotels Data

1. **Prepare Data**: Structure your hotel data in the required format
2. **Run Migration**: Apply the database migration
   ```bash
   psql $DATABASE_URL < database/migrations/003_add_hotels.sql
   ```

3. **Import Data**: Run the import script
   ```bash
   cd backend
   npm run seed:hotels
   ```

### Import Script
The import script (`backend/scripts/import-hotels.js`) accepts hotel data in a structured format and populates the database.

You can modify the `hotelsData` array in the script to match your hotel inventory.

## Pricing Structure Examples

### Example 1: Fixed Pricing
```json
{
  "name": "Standard Room",
  "pricing": [
    {
      "price_pkr": 5000
    }
  ]
}
```

### Example 2: Occupancy-Based Pricing
```json
{
  "name": "Deluxe Room",
  "pricing": [
    {
      "occupancy_type": "double",
      "price_pkr": 12000
    },
    {
      "occupancy_type": "triple",
      "price_pkr": 14000
    }
  ]
}
```

### Example 3: Seasonal Pricing
```json
{
  "name": "Suite Room",
  "pricing": [
    {
      "season_name": "peak",
      "price_pkr": 50000
    },
    {
      "season_name": "low",
      "price_pkr": 35000
    }
  ]
}
```

### Example 4: Price Ranges with Extra Services
```json
{
  "name": "Resort Villa",
  "pricing": [
    {
      "season_name": "high",
      "price_range_min": 43000,
      "price_range_max": 53000,
      "extra_services": {
        "extra_mattress": 3000,
        "heating": 2500
      }
    }
  ]
}
```

## Frontend Usage

### Navigate to Hotels
1. Admin or Manager users can see "🏨 Hotel Directory" in the sidebar
2. Click to view all hotels

### Features in Hotel Directory

#### Filter by City
- Use city buttons to filter hotels
- "All Cities" button shows all hotels

#### Search
- Search by hotel name or location
- Results update in real-time

#### Expand Hotel Details
- Click on any hotel to expand and see:
  - Contact information
  - Rating
  - Room types with details
  - Pricing information

#### View Pricing
- Fixed prices displayed clearly
- Occupancy-based pricing shown with options (Single, Double, Triple, Quad)
- Seasonal prices with season names
- Price ranges displayed
- Extra services listed separately

## Development

### Adding New Room Types
```typescript
const response = await hotelsAPI.createRoomType(hotelId, {
  name: 'Luxury Suite',
  capacity: 4,
  amenities: ['WiFi', 'AC', 'Balcony']
});
```

### Adding Room Pricing
```typescript
const response = await hotelsAPI.createRoomPricing(roomTypeId, {
  season_name: 'peak',
  price_range_min: 50000,
  price_range_max: 60000,
  extra_services: {
    'extra_mattress': 3000,
    'heating': 2500
  }
});
```

## UI/UX Features

### Responsive Design
- Mobile-friendly interface
- Collapsible hotel cards for easy viewing on smaller screens
- Flexible grid layouts

### Visual Indicators
- City badges for easy identification
- Room count badges showing number of room types
- Color-coded season indicators (peak=red, high=yellow, blossom=blue, low=green, off=gray)
- Occupancy type indicators for quick scanning

### Dark Mode Support
- Full dark mode compatibility
- Tailwind CSS dark mode classes throughout
- Proper color contrast for accessibility

### Performance
- Lazy loading of hotel details
- Pagination support for large datasets
- Efficient query structure with indexes on commonly filtered fields

## Troubleshooting

### Hotels Not Loading
1. Check database connection
2. Ensure migration was run: `003_add_hotels.sql`
3. Check API endpoint status
4. Verify user has admin or manager role

### Pricing Not Displaying Correctly
1. Check `room_pricing` table has entries
2. Verify JSON structure in `extra_services` field
3. Ensure `is_active` flag is set to true

### Search Not Working
1. Clear browser cache
2. Verify hotel names are correctly formatted in database
3. Check console for JavaScript errors

## Future Enhancements

Potential features for future development:
- [ ] Hotel image gallery
- [ ] Real-time availability calendar
- [ ] Dynamic pricing rules
- [ ] Bulk import/export functionality
- [ ] Hotel performance analytics
- [ ] Package deals combining multiple hotels
- [ ] Guest reviews integration
- [ ] Multi-language support

## Support

For issues or questions about the Hotel Directory feature:
1. Check this documentation
2. Review the API endpoints
3. Check database migration files
4. Review component implementation in `frontend/src/components/HotelsPanel.tsx`
