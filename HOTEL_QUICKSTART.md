## 🏨 HODOPHILE HOTEL DIRECTORY - QUICK START GUIDE

### What's Been Implemented

A complete Hotel Directory system for your admin and manager panels with:
✅ Hotels database with room types and pricing
✅ Support for multiple pricing models (fixed, occupancy-based, seasonal)
✅ Beautiful, responsive UI with search and filtering
✅ Full API backend with role-based access control
✅ Dark mode support
✅ Statistics dashboard

---

## 🚀 SETUP STEPS

### Step 1: Run Database Migration

```bash
# From project root
psql $DATABASE_URL < database/migrations/003_add_hotels.sql

# OR if using local PostgreSQL:
psql -U your_user -d your_db -f database/migrations/003_add_hotels.sql
```

This creates 3 new tables:
- `hotels` - Hotel information
- `room_types` - Room categories
- `room_pricing` - Pricing details

### Step 2: Import Hotel Data

The system includes a sample import script at `backend/scripts/import-hotels.js`

```bash
cd backend
node scripts/import-hotels.js
```

You can also add your own hotel data by modifying the `hotelsData` array in the script.

### Step 3: Restart Backend

```bash
npm run dev  # In backend folder
```

The API will be available at `/api/hotels`

---

## 📍 ACCESSING THE HOTEL DIRECTORY

1. **Login** as Admin or Manager
2. **Look for** "🏨 Hotel Directory" in the sidebar navigation
3. **Click** to open the Hotel Directory panel

---

## 💡 FEATURES

### City Filter
- Click any city button to filter hotels by location
- "All Cities" shows all hotels

### Search
- Type in the search box to find hotels by name or location
- Results update in real-time

### Expand Hotel Details
- Click on a hotel card to expand and see:
  - Hotel contact information
  - Hotel rating
  - All room types available
  - Complete pricing information for each room

### Price Information Shows
- **Fixed Pricing**: Simple price per room type
- **Occupancy-Based**: Different prices for 1-4 persons
- **Seasonal**: Peak, High, Low, Blossom, Off-season prices
- **Price Ranges**: Min-max prices with flexibility
- **Extra Services**: Additional charges (heating, extra mattress, etc.)

### Statistics
- Total Hotels count
- Total Cities covered
- Total Room Types

---

## 🔧 API ENDPOINTS

### Public (All Authenticated Users)
```
GET  /api/hotels                          - Get all hotels
GET  /api/hotels/cities                   - Get city list
GET  /api/hotels/city/:city               - Hotels in city
GET  /api/hotels/:hotelId                 - Hotel details
GET  /api/hotels/stats                    - Statistics
GET  /api/hotels/paginated                - Paginated results
```

### Admin/Manager Only
```
POST /api/hotels                          - Create hotel
POST /api/hotels/:hotelId/rooms           - Add room type
POST /api/hotels/rooms/:roomTypeId/pricing - Add pricing
```

---

## 📋 ADDING HOTEL DATA PROGRAMMATICALLY

You can use the API to add hotels:

```typescript
// From your app code
import { hotelsAPI } from '@/utils/api-service';

// Create hotel
await hotelsAPI.create({
  name: 'My Hotel',
  city: 'Hunza',
  contact_phone: '+92-300-1234567',
  contact_email: 'info@myhotel.com'
});

// Create room type
await hotelsAPI.createRoomType(hotelId, {
  name: 'Deluxe Suite',
  capacity: 4,
  amenities: ['WiFi', 'AC', 'Balcony']
});

// Add pricing
await hotelsAPI.createRoomPricing(roomTypeId, {
  season_name: 'peak',
  price_pkr: 25000
});
```

---

## 📊 PRICING EXAMPLES

### Example 1: Simple Fixed Price
```json
{
  "price_pkr": 5000
}
```

### Example 2: Occupancy-Based
```json
[
  { "occupancy_type": "double", "price_pkr": 12000 },
  { "occupancy_type": "triple", "price_pkr": 14000 }
]
```

### Example 3: Seasonal
```json
[
  { "season_name": "peak", "price_pkr": 50000 },
  { "season_name": "low", "price_pkr": 35000 }
]
```

### Example 4: Price Ranges with Extra Services
```json
{
  "season_name": "high",
  "price_range_min": 43000,
  "price_range_max": 53000,
  "extra_services": {
    "extra_mattress": 3000,
    "heating": 2500
  }
}
```

---

## 📁 FILES CREATED/MODIFIED

### New Files
- `database/migrations/003_add_hotels.sql` - Database schema
- `backend/src/models/Hotel.ts` - Data model
- `backend/src/controllers/hotel-controller.ts` - API controller
- `backend/src/routes/hotels.ts` - API routes
- `frontend/src/components/HotelsPanel.tsx` - UI component
- `frontend/src/components/HotelsPanel.css` - Styling
- `backend/scripts/import-hotels.js` - Import script
- `HOTELS_FEATURE.md` - Full documentation

### Modified Files
- `backend/src/index.ts` - Registered routes
- `frontend/src/utils/api-service.ts` - Added hotelsAPI
- `frontend/src/pages/App.tsx` - Added page routing and navigation

---

## 🎨 UI HIGHLIGHTS

### Responsive Design
- Mobile-friendly cards
- Works on desktop, tablet, mobile
- Collapsible sections for small screens

### Dark Mode
- Full dark mode support throughout
- Automatic based on user's system preference or manual toggle

### Visual Indicators
- City badges for quick identification
- Room count indicators
- Seasonal pricing color coding
- Occupancy type badges

---

## 🔍 TROUBLESHOOTING

### Hotels Not Showing
**Check:**
1. Database migration was run successfully
2. Hotel data was imported
3. You're logged in as Admin or Manager
4. Check browser console for errors

### Can't Find Search Results
1. Verify hotel names in database
2. Try exact spelling
3. Check hotel city name

### Prices Not Displaying
1. Ensure room_pricing table has entries
2. Check is_active flag is true
3. Verify JSON structure in extra_services

---

## 📞 SUPPORT

For detailed documentation, see: `HOTELS_FEATURE.md`

Key sections:
- Database schema details
- Complete API reference
- Component usage examples
- Data structure examples
- Development guidelines

---

## ✨ WHAT'S NEXT?

You can:
1. ✅ View all hotels - READY
2. ✅ Filter by city - READY
3. ✅ Search hotels - READY
4. ✅ View pricing - READY
5. ➕ Add edit functionality for hotels (Optional)
6. ➕ Add delete functionality (Optional)
7. ➕ Create booking integration (Optional)
8. ➕ Add availability calendar (Optional)

---

## 🎯 QUICK CHECKLIST

- [ ] Run database migration
- [ ] Import hotel data
- [ ] Restart backend
- [ ] Login as Admin/Manager
- [ ] Look for "🏨 Hotel Directory" in sidebar
- [ ] Click to open and explore
- [ ] Test filtering by city
- [ ] Test search functionality
- [ ] Expand a hotel card to see details
- [ ] View pricing information

**All Done! Your Hotel Directory is live.** 🎉
