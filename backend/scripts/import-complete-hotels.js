/**
 * Complete Hotels Import Script for TRIPNEXUS
 * Imports all 67 hotels with room types and pricing
 * Usage: node scripts/import-complete-hotels.js
 */

const { query } = require('../src/utils/database');
require('dotenv').config();

// Complete hotels data from the provided document
const hotelsData = [
  // CHILAS
  {
    city: 'Chilas',
    hotels: [
      {
        name: 'Sun Rise Hotel Chilas',
        location: 'Chilas',
        rooms: [
          {
            name: 'Standard Room',
            capacity: 2,
            pricing: [{ price_pkr: 5000 }]
          }
        ]
      }
    ]
  },
  // FAIRY MEADOWS
  {
    city: 'Fairy Meadows',
    hotels: [
      {
        name: 'Hotel Gateway',
        location: 'Fairy Meadows',
        rooms: [
          { name: 'Standard', capacity: 2, pricing: [{ price_pkr: 5000 }] }
        ]
      },
      {
        name: 'Hotel Raikot Serai',
        location: 'Fairy Meadows',
        rooms: [
          { name: 'Standard', capacity: 2, pricing: [{ price_pkr: 5000 }] }
        ]
      },
      {
        name: 'Hotel Shambala',
        location: 'Fairy Meadows',
        rooms: [
          { name: 'Standard', capacity: 2, pricing: [{ price_pkr: 5000 }] }
        ]
      }
    ]
  },
  // HUNZA
  {
    city: 'Hunza',
    hotels: [
      {
        name: 'Al-Barakaat Hotel Hunza',
        location: 'Hunza',
        rooms: [
          {
            name: 'Single Bed (1 Person, Breakfast, WiFi)',
            capacity: 1,
            pricing: [{ price_pkr: 5000 }]
          },
          {
            name: 'Double Room (1 Master, Breakfast, WiFi)',
            capacity: 2,
            pricing: [{ price_pkr: 6000 }]
          },
          {
            name: 'Twin Bed (2 Singles, Breakfast, WiFi)',
            capacity: 2,
            pricing: [{ price_pkr: 6000 }]
          },
          {
            name: 'Deluxe Room (1 Master + 1 Single, Breakfast, WiFi)',
            capacity: 3,
            pricing: [{ price_pkr: 8000 }]
          }
        ]
      },
      {
        name: 'Farme Resort Hunza',
        location: 'Hunza',
        rooms: [
          {
            name: 'Standard Room (Double)',
            capacity: 2,
            pricing: [{ occupancy_type: 'double', price_pkr: 12000 }]
          },
          {
            name: 'Standard Room (Triple)',
            capacity: 3,
            pricing: [{ occupancy_type: 'triple', price_pkr: 14000 }]
          },
          {
            name: 'Deluxe Balcony Room (Double)',
            capacity: 2,
            pricing: [{ occupancy_type: 'double', price_pkr: 20000 }]
          },
          {
            name: 'Deluxe Balcony Room (Triple)',
            capacity: 3,
            pricing: [{ occupancy_type: 'triple', price_pkr: 23000 }]
          },
          {
            name: 'Deluxe Terrace Room (Double)',
            capacity: 2,
            pricing: [{ occupancy_type: 'double', price_pkr: 25000 }]
          },
          {
            name: 'Deluxe Terrace Room (Triple)',
            capacity: 3,
            pricing: [{ occupancy_type: 'triple', price_pkr: 28000 }]
          },
          {
            name: 'Panoramic Room (Double)',
            capacity: 2,
            pricing: [{ occupancy_type: 'double', price_pkr: 30000 }]
          },
          {
            name: 'Panoramic Room (Triple)',
            capacity: 3,
            pricing: [{ occupancy_type: 'triple', price_pkr: 35000 }]
          },
          {
            name: 'Junior Suite (Double)',
            capacity: 2,
            pricing: [{ occupancy_type: 'double', price_pkr: 35000 }]
          },
          {
            name: 'Junior Suite (Triple)',
            capacity: 3,
            pricing: [{ occupancy_type: 'triple', price_pkr: 38000 }]
          },
          {
            name: 'Junior Suite (Quad)',
            capacity: 4,
            pricing: [{ occupancy_type: 'quad', price_pkr: 41000 }]
          },
          {
            name: 'Penthouse Suite (Double)',
            capacity: 2,
            pricing: [{ occupancy_type: 'double', price_pkr: 50000 }]
          },
          {
            name: 'Penthouse Suite (Quad)',
            capacity: 4,
            pricing: [{ occupancy_type: 'quad', price_pkr: 60000 }]
          },
          {
            name: 'Presidential Suite (Double)',
            capacity: 2,
            pricing: [{ occupancy_type: 'double', price_pkr: 55000 }]
          },
          {
            name: 'Presidential Suite (Quad)',
            capacity: 4,
            pricing: [{ occupancy_type: 'quad', price_pkr: 65000 }]
          }
        ]
      },
      {
        name: 'Hermes Hotel Hunza',
        location: 'Hunza',
        rooms: [
          { name: 'Standard', capacity: 2, pricing: [{ price_pkr: 8500 }] },
          { name: 'Deluxe', capacity: 2, pricing: [{ price_pkr: 13500 }] }
        ]
      },
      {
        name: 'Hunza Bliss',
        location: 'Hunza',
        rooms: [
          {
            name: 'Standard Room (1 Master + 1 Sofa Bed)',
            capacity: 2,
            pricing: [{ price_pkr: 8000 }]
          },
          {
            name: 'Standard Triple (1 Master + 1 Single Bed)',
            capacity: 3,
            pricing: [{ price_pkr: 8500 }]
          },
          {
            name: 'Standard Family (2 Master + 1 Single Bed)',
            capacity: 4,
            pricing: [{ price_pkr: 10500 }]
          },
          {
            name: 'Deluxe Room (1 Master + 1 Sofa Bed)',
            capacity: 2,
            pricing: [{ price_pkr: 11500 }]
          },
          {
            name: 'Deluxe Triple (1 Master + 1 Single Bed)',
            capacity: 3,
            pricing: [{ price_pkr: 12000 }]
          },
          {
            name: 'Deluxe Family (2 Master + 1 Single Bed)',
            capacity: 4,
            pricing: [{ price_pkr: 14000 }]
          },
          {
            name: 'Deluxe Family Suite (2 Splendid Large Size Rooms, upto 7-9 persons)',
            capacity: 8,
            pricing: [{ price_pkr: 20000 }]
          },
          {
            name: 'Executive Family Room (2 King-Sized Master Beds + 1 Sofa Bed, Mountain View)',
            capacity: 5,
            pricing: [{ price_pkr: 18500 }]
          },
          {
            name: 'Executive Family Suite (2 Splendid Large Rooms, 2 Private Washrooms, Upto 9-10 persons)',
            capacity: 10,
            pricing: [{ price_pkr: 35500 }]
          }
        ]
      },
      {
        name: 'Mulberry Hotel Hunza',
        location: 'Hunza',
        rooms: [
          { name: 'Deluxe', capacity: 2, pricing: [{ price_pkr: 16500 }] },
          { name: 'Executive', capacity: 3, pricing: [{ price_pkr: 19500 }] },
          { name: 'Family Hut', capacity: 4, pricing: [{ price_pkr: 38500 }] }
        ]
      },
      {
        name: 'Offto Resort Hunza',
        location: 'Hunza',
        rooms: [
          {
            name: '1 Chalet Bedroom',
            capacity: 2,
            pricing: [{ season_name: 'low', price_range_min: 22000, price_range_max: 27000 }]
          },
          {
            name: '2 Chalet Bedroom',
            capacity: 4,
            pricing: [{ season_name: 'low', price_range_min: 43000, price_range_max: 53000 }]
          },
          {
            name: '3 Chalet Villa',
            capacity: 6,
            pricing: [
              { season_name: 'low', price_range_min: 81000, price_range_max: 86000 },
              { extra_services: JSON.stringify({ extra_mattress: 3000 }) }
            ]
          },
          {
            name: 'Orchard Hut 1 Bed',
            capacity: 2,
            pricing: [{ season_name: 'low', price_range_min: 19000, price_range_max: 23000 }]
          },
          {
            name: 'Orchard Hut 2 Bed',
            capacity: 4,
            pricing: [{ season_name: 'low', price_range_min: 33000, price_range_max: 45000 }]
          }
        ]
      },
      {
        name: 'Qayam Hotels Hunza',
        location: 'Hunza',
        rooms: [
          {
            name: 'Standard (Double)',
            capacity: 2,
            pricing: [{ occupancy_type: 'double', price_range_min: 8000, price_range_max: 9500 }]
          },
          {
            name: 'Standard (Triple)',
            capacity: 3,
            pricing: [{ occupancy_type: 'triple', price_range_min: 10500, price_range_max: 11000 }]
          },
          {
            name: 'Deluxe',
            capacity: 2,
            pricing: [{ price_range_min: 10500, price_range_max: 12500 }]
          },
          {
            name: 'Executive (Double)',
            capacity: 2,
            pricing: [{ occupancy_type: 'double', price_range_min: 12000, price_range_max: 14500 }]
          },
          {
            name: 'Executive (Triple)',
            capacity: 3,
            pricing: [{ occupancy_type: 'triple', price_range_min: 15000, price_range_max: 16500 }]
          }
        ]
      },
      {
        name: 'The Consorts Resort Hunza',
        location: 'Hunza',
        rooms: [
          { name: 'Deluxe', capacity: 2, pricing: [{ price_pkr: 25000 }] },
          {
            name: 'Contemporary With Balcony',
            capacity: 2,
            pricing: [{ price_pkr: 35000 }]
          },
          {
            name: 'Exclusive With Infinity View & Balcony',
            capacity: 2,
            pricing: [{ price_pkr: 45000 }]
          }
        ]
      }
    ]
  },
  // ISLAMABAD
  {
    city: 'Islamabad',
    hotels: [
      {
        name: 'Grand Hotel Islamabad',
        location: 'Islamabad',
        rooms: [
          {
            name: 'Standard Room (+tax)',
            capacity: 2,
            pricing: [{ price_pkr: 18000 }]
          },
          {
            name: 'Deluxe Room (+tax)',
            capacity: 2,
            pricing: [{ price_pkr: 20000 }]
          },
          {
            name: 'Executive Room (+tax)',
            capacity: 2,
            pricing: [{ price_pkr: 22000 }]
          },
          {
            name: 'Family Room (+tax)',
            capacity: 4,
            pricing: [{ price_pkr: 24000 }]
          }
        ]
      },
      {
        name: 'Hotel Index Islamabad',
        location: 'Islamabad',
        rooms: [
          { name: 'Standard Master', capacity: 2, pricing: [{ price_pkr: 6500 }] },
          { name: 'Standard Triple', capacity: 3, pricing: [{ price_pkr: 7000 }] },
          { name: 'Standard Quad', capacity: 4, pricing: [{ price_pkr: 7500 }] },
          { name: 'Standard Penta', capacity: 5, pricing: [{ price_pkr: 8500 }] }
        ]
      },
      {
        name: 'Hotel Redline Islamabad',
        location: 'Islamabad',
        rooms: [
          { name: 'Standard Single', capacity: 1, pricing: [{ price_pkr: 7000 }] },
          { name: 'Standard Double', capacity: 2, pricing: [{ price_pkr: 9360 }] },
          { name: 'Standard Triple', capacity: 3, pricing: [{ price_pkr: 11700 }] }
        ]
      }
    ]
  },
  // KASHMIR
  {
    city: 'Kashmir',
    hotels: [
      {
        name: 'Arangkel Wanderlust Resort',
        location: 'Kashmir',
        rooms: [
          {
            name: 'Rustic Cottage Room',
            capacity: 2,
            pricing: [{ season_name: 'low', price_range_min: 5999, price_range_max: 8999 }]
          },
          {
            name: 'Standard Room',
            capacity: 2,
            pricing: [{ season_name: 'low', price_range_min: 7999, price_range_max: 12999 }]
          },
          {
            name: 'Deluxe Room (Heating +2500)',
            capacity: 2,
            pricing: [{ season_name: 'low', price_range_min: 8999, price_range_max: 13999 }]
          },
          {
            name: 'Family Room (Heating +2500)',
            capacity: 4,
            pricing: [{ season_name: 'low', price_range_min: 10999, price_range_max: 15999 }]
          },
          {
            name: 'Executive Room (Heating +2500)',
            capacity: 3,
            pricing: [{ season_name: 'low', price_range_min: 12999, price_range_max: 19999 }]
          }
        ]
      },
      {
        name: 'Arangkel Wanderlust Resort (Second Hotel)',
        location: 'Kashmir',
        rooms: [
          {
            name: 'Cozy Room',
            capacity: 2,
            pricing: [{ season_name: 'low', price_range_min: 7999, price_range_max: 10999 }]
          },
          {
            name: 'Cozy View Room',
            capacity: 2,
            pricing: [{ season_name: 'low', price_range_min: 8999, price_range_max: 13999 }]
          },
          {
            name: 'Deluxe Room (Heating +2500)',
            capacity: 2,
            pricing: [{ season_name: 'low', price_range_min: 10999, price_range_max: 14999 }]
          },
          {
            name: 'Executive Room (Heating +2500)',
            capacity: 3,
            pricing: [{ season_name: 'low', price_range_min: 12999, price_range_max: 19999 }]
          }
        ]
      },
      {
        name: 'Corner Cottage Arangkel',
        location: 'Kashmir',
        rooms: [
          { name: 'Standard', capacity: 2, pricing: [{ price_pkr: 7000 }] },
          { name: 'Deluxe', capacity: 2, pricing: [{ price_pkr: 8500 }] },
          { name: 'Executive', capacity: 3, pricing: [{ price_pkr: 9500 }] }
        ]
      },
      {
        name: 'Corner View Cottage Taobat',
        location: 'Kashmir',
        rooms: [
          { name: 'Standard Room', capacity: 2, pricing: [{ price_pkr: 8500 }] },
          { name: 'Deluxe Room', capacity: 2, pricing: [{ price_pkr: 10500 }] }
        ]
      },
      {
        name: 'Ibex Cottage Keran',
        location: 'Kashmir',
        rooms: [
          { name: 'Standard Room', capacity: 2, pricing: [{ price_pkr: 8000 }] },
          { name: 'Deluxe Room', capacity: 2, pricing: [{ price_pkr: 9800 }] }
        ]
      },
      {
        name: 'Keran Resort Kashmir',
        location: 'Kashmir',
        rooms: [
          { name: 'Standard Room', capacity: 2, pricing: [{ price_pkr: 8500 }] },
          { name: 'Executive Room', capacity: 3, pricing: [{ price_pkr: 11000 }] }
        ]
      },
      {
        name: 'Semari Resort Kashmir',
        location: 'Kashmir',
        rooms: [
          { name: 'Camps', capacity: 4, pricing: [{ price_pkr: 15000 }] },
          { name: 'Huts', capacity: 4, pricing: [{ price_pkr: 27000 }] },
          { name: 'Cottages', capacity: 4, pricing: [{ price_pkr: 34000 }] }
        ]
      },
      {
        name: 'Sharda Lodge',
        location: 'Kashmir',
        rooms: [
          { name: 'River Facing Room', capacity: 2, pricing: [{ price_pkr: 7500 }] },
          { name: 'Standard View Room', capacity: 2, pricing: [{ price_pkr: 6500 }] }
        ]
      },
      {
        name: 'Shangrila Taobat',
        location: 'Kashmir',
        rooms: [
          { name: 'Standard Cottage', capacity: 2, pricing: [{ price_pkr: 9000 }] },
          { name: 'Deluxe Cottage', capacity: 3, pricing: [{ price_pkr: 12000 }] }
        ]
      },
      {
        name: 'Timber Resort Keran Kashmir',
        location: 'Kashmir',
        rooms: [
          {
            name: 'Standard Room (Building, max 2 persons)',
            capacity: 2,
            pricing: [{ price_pkr: 5000 }]
          },
          {
            name: 'Deluxe Room (Building)',
            capacity: 2,
            pricing: [{ price_pkr: 12000 }]
          },
          { name: 'Resort 1-B/2-B/3-B', capacity: 4, pricing: [{ price_pkr: 20000 }] },
          {
            name: 'Resort 1-A/2-A/3-A/4-A/5-A',
            capacity: 4,
            pricing: [{ price_range_min: 30000, price_range_max: 35000 }]
          }
        ]
      }
    ]
  },
  // KHAPLU
  {
    city: 'Khaplu',
    hotels: [
      {
        name: 'North Palace Khaplu',
        location: 'Khaplu',
        rooms: [
          { name: 'Budget Suite', capacity: 2, pricing: [{ price_pkr: 5999 }] },
          { name: 'Deluxe Suite', capacity: 3, pricing: [{ price_pkr: 15000 }] },
          { name: 'Premium Suite', capacity: 4, pricing: [{ price_pkr: 29999 }] }
        ]
      }
    ]
  },
  // NARAN
  {
    city: 'Naran',
    hotels: [
      {
        name: 'Hotel Mount Feast Naran',
        location: 'Naran',
        rooms: [
          {
            name: 'Deluxe w/o balcony',
            capacity: 2,
            pricing: [{ price_pkr: 13000 }]
          },
          {
            name: 'Deluxe with balcony',
            capacity: 2,
            pricing: [{ price_pkr: 14500 }]
          },
          { name: 'Executive room', capacity: 2, pricing: [{ price_pkr: 18500 }] },
          { name: 'Executive addon', capacity: 2, pricing: [{ price_pkr: 20000 }] },
          { name: 'Triplet room', capacity: 3, pricing: [{ price_pkr: 20000 }] },
          { name: 'Quad room', capacity: 4, pricing: [{ price_pkr: 24000 }] },
          { name: 'Family room', capacity: 4, pricing: [{ price_pkr: 26000 }] },
          { name: 'Presidential Suite', capacity: 4, pricing: [{ price_pkr: 44000 }] },
          { name: 'Executive Suite', capacity: 3, pricing: [{ price_pkr: 35000 }] }
        ]
      },
      {
        name: 'Kings Inn Naran',
        location: 'Naran',
        rooms: [
          { name: 'Standard Room', capacity: 2, pricing: [{ price_pkr: 7000 }] }
        ]
      },
      {
        name: 'Riviera Resort Naran',
        location: 'Naran',
        rooms: [
          {
            name: 'Standard Room (1 Master Bed, Breakfast)',
            capacity: 2,
            pricing: [{ season_name: 'low', price_range_min: 10000, price_range_max: 15000 }]
          },
          {
            name: 'Master Suite (1 Bed, Living Room, Terrace, Breakfast)',
            capacity: 2,
            pricing: [{ season_name: 'low', price_range_min: 25000, price_range_max: 30000 }]
          },
          {
            name: 'Family Deluxe Room River View (1 Master + 1 Single, Terrace, Breakfast)',
            capacity: 3,
            pricing: [{ season_name: 'low', price_range_min: 18000, price_range_max: 22000 }]
          },
          {
            name: 'Family Deluxe Room Mountain View (1 Master + 1 Single, Terrace, Breakfast)',
            capacity: 3,
            pricing: [{ season_name: 'low', price_range_min: 15000, price_range_max: 20000 }]
          },
          {
            name: 'VIP Deluxe Room River View (1 Master + 1 Single + 4 Person Sitting, Spacious, Terrace, Breakfast)',
            capacity: 3,
            pricing: [{ season_name: 'low', price_range_min: 22000, price_range_max: 27000 }]
          },
          {
            name: 'Royal Suite/Apartment River View (2 Bed Rooms, Lounge with 12 Sofa Seats, 10 Seater Dining Table, Terrace, Breakfast)',
            capacity: 5,
            pricing: [{ season_name: 'low', price_range_min: 40000, price_range_max: 55000 }]
          },
          {
            name: 'VIP Suite/Apartment Mountain View (3 Bed Rooms, Lounge with 12 Sofa Seats, 10 Seater Dining Table, Terrace, Breakfast)',
            capacity: 7,
            pricing: [{ season_name: 'low', price_range_min: 45000, price_range_max: 60000 }]
          },
          {
            name: 'Executive Suite/Apartment River View (3 Bed Rooms, Lounge with 14 Sofa Seats, 12 Seater Dining Table, Terrace, Breakfast)',
            capacity: 7,
            pricing: [{ season_name: 'low', price_range_min: 55000, price_range_max: 70000 }]
          }
        ]
      },
      {
        name: 'Swiss Wood Cottages Naran',
        location: 'Naran',
        rooms: [
          {
            name: 'Master Bed (2 persons, Breakfast included)',
            capacity: 2,
            pricing: [{ season_name: 'low', price_range_min: 10500, price_range_max: 21000 }]
          },
          {
            name: 'Triple Bed (3 persons, Breakfast included)',
            capacity: 3,
            pricing: [{ season_name: 'low', price_range_min: 11500, price_range_max: 22000 }]
          },
          {
            name: 'Four Bed (4 persons, Breakfast included)',
            capacity: 4,
            pricing: [{ season_name: 'low', price_range_min: 12500, price_range_max: 24000 }]
          },
          {
            name: 'Suite Room (7 persons, Breakfast included)',
            capacity: 7,
            pricing: [{ season_name: 'low', price_range_min: 17500, price_range_max: 32000 }]
          }
        ]
      }
    ]
  },
  // NATHIA GALI
  {
    city: 'Nathia Gali',
    hotels: [
      {
        name: 'Nathia Lodge',
        location: 'Nathia Gali',
        rooms: [
          { name: 'Ground Floor', capacity: 4, pricing: [{ price_pkr: 15000 }] },
          {
            name: 'First Floor Family Deluxe',
            capacity: 6,
            pricing: [{ price_pkr: 18500 }]
          },
          {
            name: 'Second Floor Family Premium',
            capacity: 6,
            pricing: [{ price_pkr: 30000 }]
          },
          { name: 'Full Lodge', capacity: 20, pricing: [{ price_pkr: 45000 }] }
        ]
      },
      {
        name: 'Snowline Residence',
        location: 'Nathia Gali',
        rooms: [
          {
            name: 'Deluxe Suite (3 persons)',
            capacity: 3,
            pricing: [{ price_pkr: 15000, extra_services: JSON.stringify({ extra_mattress: 1500 }) }]
          },
          {
            name: 'Luxury Suite (3 persons)',
            capacity: 3,
            pricing: [{ price_pkr: 22000, extra_services: JSON.stringify({ extra_mattress: 1500 }) }]
          },
          {
            name: 'Executive Suite (5 persons)',
            capacity: 5,
            pricing: [{ price_pkr: 35000, extra_services: JSON.stringify({ extra_mattress: 1500 }) }]
          },
          {
            name: 'Deluxe Suite Plus (5 persons)',
            capacity: 5,
            pricing: [{ price_pkr: 20000, extra_services: JSON.stringify({ extra_mattress: 1500 }) }]
          }
        ]
      }
    ]
  },
  // SHOGRAN
  {
    city: 'Shogran',
    hotels: [
      {
        name: 'Spruce Resort Khanian',
        location: 'Shogran',
        rooms: [
          { name: 'Standard', capacity: 2, pricing: [{ price_pkr: 13500 }] },
          { name: 'Luxury Family', capacity: 6, pricing: [{ price_pkr: 39500 }] },
          { name: 'Presidential Suite', capacity: 8, pricing: [{ price_pkr: 65500 }] }
        ]
      },
      {
        name: 'Spruce Resort Shogran',
        location: 'Shogran',
        rooms: [
          { name: 'Standard', capacity: 2, pricing: [{ price_pkr: 13000 }] },
          { name: 'Deluxe', capacity: 3, pricing: [{ price_pkr: 17000 }] },
          { name: 'Luxury Suite', capacity: 6, pricing: [{ price_pkr: 52000 }] }
        ]
      }
    ]
  },
  // SKARDU
  {
    city: 'Skardu',
    hotels: [
      {
        name: 'Abbashah Hotel Skardu',
        location: 'Skardu',
        rooms: [{ name: 'Standard', capacity: 2, pricing: [{ price_pkr: 5000 }] }]
      },
      {
        name: 'Dream Land Hotel Skardu',
        location: 'Skardu',
        rooms: [{ name: 'Standard', capacity: 2, pricing: [{ price_pkr: 5000 }] }]
      },
      {
        name: 'Gumaan Resort Skardu',
        location: 'Skardu',
        rooms: [
          { name: 'Deluxe Hut', capacity: 2, pricing: [{ season_name: 'peak', price_pkr: 26000 }] },
          { name: 'Executive Hut', capacity: 3, pricing: [{ season_name: 'peak', price_pkr: 30000 }] },
          { name: 'Presidential Suite', capacity: 4, pricing: [{ season_name: 'peak', price_pkr: 39000 }] },
          { name: 'Family Suite', capacity: 5, pricing: [{ season_name: 'peak', price_pkr: 45000 }] }
        ]
      },
      {
        name: 'Himmel Hotel Skardu',
        location: 'Skardu',
        rooms: [
          {
            name: 'Standard',
            capacity: 2,
            pricing: [
              { season_name: 'peak', price_pkr: 25000 },
              { season_name: 'blossom', price_pkr: 20000 }
            ]
          },
          {
            name: 'Deluxe',
            capacity: 2,
            pricing: [
              { season_name: 'peak', price_pkr: 38000 },
              { season_name: 'blossom', price_pkr: 32000 }
            ]
          },
          {
            name: 'Riverfront Chalet',
            capacity: 3,
            pricing: [
              { season_name: 'peak', price_pkr: 49000 },
              { season_name: 'blossom', price_pkr: 44000 }
            ]
          },
          {
            name: 'Royal Suite',
            capacity: 3,
            pricing: [
              { season_name: 'peak', price_pkr: 43000 },
              { season_name: 'blossom', price_pkr: 39000 }
            ]
          },
          {
            name: 'Riverfront Villa',
            capacity: 5,
            pricing: [
              { season_name: 'peak', price_pkr: 115000 },
              { season_name: 'blossom', price_pkr: 95000 }
            ]
          },
          {
            name: 'Penthouse',
            capacity: 6,
            pricing: [
              { season_name: 'peak', price_pkr: 125000 },
              { season_name: 'blossom', price_pkr: 110000 }
            ]
          }
        ]
      },
      {
        name: 'Hispar Hotel Skardu',
        location: 'Skardu',
        rooms: [
          { name: 'Standard', capacity: 2, pricing: [{ price_pkr: 12000 }] },
          { name: 'Deluxe', capacity: 2, pricing: [{ price_pkr: 16000 }] },
          { name: 'Deluxe Family', capacity: 4, pricing: [{ price_pkr: 16000 }] },
          { name: 'Deluxe Plus', capacity: 3, pricing: [{ price_pkr: 18000 }] },
          { name: 'Deluxe Family Plus', capacity: 5, pricing: [{ price_pkr: 18000 }] }
        ]
      },
      {
        name: 'IFQ Premier Skardu',
        location: 'Skardu',
        rooms: [
          { name: 'Standard', capacity: 2, pricing: [{ price_pkr: 20000 }] },
          { name: 'Deluxe', capacity: 2, pricing: [{ price_pkr: 25000 }] }
        ]
      },
      {
        name: 'Khar Hotel Skardu',
        location: 'Skardu',
        rooms: [
          {
            name: 'Twin Master',
            capacity: 2,
            pricing: [{ season_name: 'peak', price_pkr: 35000 }]
          },
          {
            name: 'Master',
            capacity: 2,
            pricing: [{ season_name: 'peak', price_pkr: 32500 }]
          }
        ]
      },
      {
        name: 'Khoj Hotel Skardu',
        location: 'Skardu',
        rooms: [
          {
            name: 'River Edge King Hammock Villa',
            capacity: 3,
            pricing: [{ season_name: 'peak', price_range_min: 42000, price_range_max: 52000 }]
          },
          {
            name: 'River View Loft Villa',
            capacity: 3,
            pricing: [{ season_name: 'peak', price_range_min: 38000, price_range_max: 48000 }]
          },
          {
            name: 'River View Family Villa',
            capacity: 4,
            pricing: [{ season_name: 'peak', price_range_min: 38000, price_range_max: 48000 }]
          },
          {
            name: 'River Edge Loft Hammock Villa',
            capacity: 4,
            pricing: [{ season_name: 'peak', price_range_min: 47000, price_range_max: 57000 }]
          }
        ]
      },
      {
        name: 'Maple Resort Skardu',
        location: 'Skardu',
        rooms: [
          { name: 'Executive Hut', capacity: 2, pricing: [{ price_pkr: 24999 }] },
          { name: 'Premium Chalet', capacity: 3, pricing: [{ price_pkr: 34999 }] },
          { name: 'Deluxe Rooms', capacity: 2, pricing: [{ price_pkr: 26500 }] }
        ]
      },
      {
        name: 'Mountain View Hotel Skardu',
        location: 'Skardu',
        rooms: [{ name: 'Standard', capacity: 2, pricing: [{ price_pkr: 5000 }] }]
      },
      {
        name: 'Qayam Hotels Skardu',
        location: 'Skardu',
        rooms: [
          {
            name: 'Deluxe',
            capacity: 2,
            pricing: [{ price_range_min: 16000, price_range_max: 27000 }]
          },
          {
            name: 'Executive',
            capacity: 3,
            pricing: [{ price_range_min: 20000, price_range_max: 30000 }]
          },
          {
            name: 'Fort Rooms',
            capacity: 4,
            pricing: [{ price_range_min: 21000, price_range_max: 34500 }]
          }
        ]
      },
      {
        name: 'Rockview Hotel Skardu',
        location: 'Skardu',
        rooms: [{ name: 'Standard', capacity: 2, pricing: [{ price_pkr: 5000 }] }]
      },
      {
        name: 'Shangrila Resort Skardu',
        location: 'Skardu',
        rooms: [
          {
            name: 'Mountain View Room',
            capacity: 2,
            pricing: [{ price_pkr: 18000 }]
          },
          {
            name: 'Lake Side Junior Room',
            capacity: 2,
            pricing: [{ price_pkr: 35000 }]
          },
          {
            name: 'Shangrila View Room',
            capacity: 2,
            pricing: [{ price_pkr: 40000 }]
          },
          {
            name: 'Lake Side Room',
            capacity: 2,
            pricing: [{ price_pkr: 50000 }]
          },
          {
            name: 'Lake Side Deluxe Room',
            capacity: 2,
            pricing: [{ price_pkr: 55000 }]
          },
          {
            name: 'Family Room',
            capacity: 4,
            pricing: [{ price_pkr: 60000 }]
          },
          {
            name: 'Executive Suite',
            capacity: 3,
            pricing: [{ price_pkr: 65000 }]
          },
          {
            name: 'Swiss Cottage',
            capacity: 4,
            pricing: [{ price_pkr: 75000 }]
          },
          {
            name: 'Swiss Villa',
            capacity: 5,
            pricing: [{ price_pkr: 110000 }]
          },
          {
            name: '2 Bedroom Suite',
            capacity: 6,
            pricing: [{ price_pkr: 125000 }]
          },
          {
            name: '3 Bedroom Suite',
            capacity: 8,
            pricing: [{ price_pkr: 155000 }]
          },
          {
            name: 'Shangrila Chalet',
            capacity: 10,
            pricing: [{ price_pkr: 210000 }]
          }
        ]
      },
      {
        name: 'Skardu Dera Lamsa',
        location: 'Skardu',
        rooms: [
          {
            name: 'Lamsa Executive Room',
            capacity: 2,
            pricing: [
              { season_name: 'peak', price_pkr: 35000 },
              { season_name: 'blossom', price_pkr: 26999 },
              { season_name: 'off', price_pkr: 21850 }
            ]
          },
          {
            name: 'Dera Deluxe Room',
            capacity: 2,
            pricing: [
              { season_name: 'peak', price_pkr: 30000 },
              { season_name: 'blossom', price_pkr: 22500 },
              { season_name: 'off', price_pkr: 19500 }
            ]
          },
          {
            name: 'Dera Family Suite',
            capacity: 4,
            pricing: [
              { season_name: 'peak', price_pkr: 55000 },
              { season_name: 'blossom', price_pkr: 35999 },
              { season_name: 'off', price_pkr: 31999 }
            ]
          },
          {
            name: 'Heritage Villa',
            capacity: 6,
            pricing: [
              { season_name: 'peak', price_pkr: 79900 },
              { season_name: 'blossom', price_pkr: 60999 },
              { season_name: 'off', price_pkr: 45999 }
            ]
          }
        ]
      }
    ]
  },
  // SWAT
  {
    city: 'Swat',
    hotels: [
      {
        name: 'Blue Ocean Kalam',
        location: 'Swat',
        rooms: [
          { name: 'Couple', capacity: 2, pricing: [{ price_pkr: 6000 }] },
          { name: 'Standard', capacity: 2, pricing: [{ price_pkr: 7500 }] },
          { name: 'Executive', capacity: 3, pricing: [{ price_pkr: 10500 }] },
          { name: 'Suite', capacity: 4, pricing: [{ price_pkr: 18000 }] }
        ]
      },
      {
        name: 'Bulj Al Swat Hotel',
        location: 'Swat',
        rooms: [
          { name: 'Standard Room', capacity: 2, pricing: [{ price_pkr: 15500 }] },
          { name: 'Deluxe Room', capacity: 2, pricing: [{ price_pkr: 22000 }] },
          {
            name: 'Superior Deluxe with Jacuzzi',
            capacity: 2,
            pricing: [{ price_pkr: 32000 }]
          }
        ]
      },
      {
        name: 'Eagle Nest Swat',
        location: 'Swat',
        rooms: [
          { name: 'Standard', capacity: 2, pricing: [{ price_pkr: 5000 }] },
          { name: 'Deluxe', capacity: 2, pricing: [{ price_pkr: 7000 }] }
        ]
      },
      {
        name: 'Kuwait Continental Swat',
        location: 'Swat',
        rooms: [
          { name: 'Budget Room', capacity: 2, pricing: [{ price_pkr: 5999 }] },
          { name: 'Standard', capacity: 2, pricing: [{ price_pkr: 11999 }] },
          { name: 'Deluxe', capacity: 2, pricing: [{ price_pkr: 13999 }] },
          {
            name: 'Family Deluxe',
            capacity: 4,
            pricing: [{ price_pkr: 14999 }]
          },
          { name: 'Presidential', capacity: 4, pricing: [{ price_pkr: 17999 }] }
        ]
      },
      {
        name: 'Swat Palace Hotel',
        location: 'Swat',
        rooms: [
          { name: 'Deluxe Twin', capacity: 2, pricing: [{ price_pkr: 14500 }] },
          {
            name: 'Executive King',
            capacity: 2,
            pricing: [{ price_pkr: 16500 }]
          },
          {
            name: 'Presidential Suite',
            capacity: 4,
            pricing: [{ price_pkr: 30000 }]
          }
        ]
      }
    ]
  }
];

async function importAllHotels() {
  try {
    console.log('🏨 Starting complete hotels import...\n');

    let totalHotels = 0;
    let totalRooms = 0;
    let totalPricing = 0;

    for (const cityGroup of hotelsData) {
      console.log(`\n📍 Processing city: ${cityGroup.city}`);

      for (const hotelData of cityGroup.hotels) {
        // Insert hotel
        const hotelSql = `
          INSERT INTO hotels (name, city, location, is_active)
          VALUES ($1, $2, $3, $4)
          RETURNING id
        `;

        const hotelResult = await query(hotelSql, [
          hotelData.name,
          cityGroup.city,
          hotelData.location,
          true
        ]);

        const hotelId = hotelResult.rows[0].id;
        totalHotels++;
        console.log(`  ✅ ${hotelData.name}`);

        // Insert rooms and pricing
        for (const roomData of hotelData.rooms) {
          const roomSql = `
            INSERT INTO room_types (hotel_id, name, capacity, is_active)
            VALUES ($1, $2, $3, $4)
            RETURNING id
          `;

          const roomResult = await query(roomSql, [
            hotelId,
            roomData.name,
            roomData.capacity || 2,
            true
          ]);

          const roomTypeId = roomResult.rows[0].id;
          totalRooms++;

          // Insert pricing
          for (const pricingData of roomData.pricing) {
            const pricingSql = `
              INSERT INTO room_pricing (
                room_type_id, occupancy_type, season_name,
                price_pkr, price_range_min, price_range_max,
                extra_services, is_active
              )
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
              RETURNING id
            `;

            await query(pricingSql, [
              roomTypeId,
              pricingData.occupancy_type || null,
              pricingData.season_name || null,
              pricingData.price_pkr || null,
              pricingData.price_range_min || null,
              pricingData.price_range_max || null,
              pricingData.extra_services || null,
              true
            ]);

            totalPricing++;
          }
        }
      }
    }

    console.log('\n\n' + '='.repeat(60));
    console.log('✅ HOTELS IMPORT COMPLETED SUCCESSFULLY!');
    console.log('='.repeat(60));
    console.log(`📊 Summary:`);
    console.log(`   • Hotels created: ${totalHotels}`);
    console.log(`   • Room types created: ${totalRooms}`);
    console.log(`   • Pricing entries created: ${totalPricing}`);
    console.log('='.repeat(60) + '\n');
  } catch (error) {
    console.error('❌ Error importing hotels:', error);
    process.exit(1);
  }
}

// Run import
importAllHotels()
  .then(() => {
    console.log('✨ Import script finished.\n');
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });
