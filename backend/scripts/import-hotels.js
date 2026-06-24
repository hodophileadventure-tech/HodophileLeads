/**
 * Script to import hotels data from the provided text format into the database
 * Usage: node scripts/import-hotels.js
 */

const { query } = require('../src/utils/database');
const path = require('path');
require('dotenv').config();

// Hotel data structure - this would be parsed from the text file
const hotelsData = [
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
  {
    city: 'Fairy Meadows',
    hotels: [
      {
        name: 'Hotel Gateway',
        location: 'Fairy Meadows',
        rooms: [
          {
            name: 'Standard',
            capacity: 2,
            pricing: [{ price_pkr: 5000 }]
          }
        ]
      },
      {
        name: 'Hotel Raikot Serai',
        location: 'Fairy Meadows',
        rooms: [
          {
            name: 'Standard',
            capacity: 2,
            pricing: [{ price_pkr: 5000 }]
          }
        ]
      },
      {
        name: 'Hotel Shambala',
        location: 'Fairy Meadows',
        rooms: [
          {
            name: 'Standard',
            capacity: 2,
            pricing: [{ price_pkr: 5000 }]
          }
        ]
      }
    ]
  },
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
            pricing: [
              { occupancy_type: 'double', price_pkr: 12000 }
            ]
          },
          {
            name: 'Standard Room (Triple)',
            capacity: 3,
            pricing: [
              { occupancy_type: 'triple', price_pkr: 14000 }
            ]
          },
          {
            name: 'Deluxe Balcony Room (Double)',
            capacity: 2,
            pricing: [
              { occupancy_type: 'double', price_pkr: 20000 }
            ]
          },
          {
            name: 'Deluxe Balcony Room (Triple)',
            capacity: 3,
            pricing: [
              { occupancy_type: 'triple', price_pkr: 23000 }
            ]
          },
          {
            name: 'Deluxe Terrace Room (Double)',
            capacity: 2,
            pricing: [
              { occupancy_type: 'double', price_pkr: 25000 }
            ]
          },
          {
            name: 'Deluxe Terrace Room (Triple)',
            capacity: 3,
            pricing: [
              { occupancy_type: 'triple', price_pkr: 28000 }
            ]
          },
          {
            name: 'Panoramic Room (Double)',
            capacity: 2,
            pricing: [
              { occupancy_type: 'double', price_pkr: 30000 }
            ]
          },
          {
            name: 'Panoramic Room (Triple)',
            capacity: 3,
            pricing: [
              { occupancy_type: 'triple', price_pkr: 35000 }
            ]
          },
          {
            name: 'Junior Suite (Double)',
            capacity: 2,
            pricing: [
              { occupancy_type: 'double', price_pkr: 35000 }
            ]
          },
          {
            name: 'Junior Suite (Triple)',
            capacity: 3,
            pricing: [
              { occupancy_type: 'triple', price_pkr: 38000 }
            ]
          },
          {
            name: 'Junior Suite (Quad)',
            capacity: 4,
            pricing: [
              { occupancy_type: 'quad', price_pkr: 41000 }
            ]
          },
          {
            name: 'Penthouse Suite (Double)',
            capacity: 2,
            pricing: [
              { occupancy_type: 'double', price_pkr: 50000 }
            ]
          },
          {
            name: 'Penthouse Suite (Quad)',
            capacity: 4,
            pricing: [
              { occupancy_type: 'quad', price_pkr: 60000 }
            ]
          },
          {
            name: 'Presidential Suite (Double)',
            capacity: 2,
            pricing: [
              { occupancy_type: 'double', price_pkr: 55000 }
            ]
          },
          {
            name: 'Presidential Suite (Quad)',
            capacity: 4,
            pricing: [
              { occupancy_type: 'quad', price_pkr: 65000 }
            ]
          }
        ]
      }
      // Additional hotels would be added here...
    ]
  }
];

async function importHotels() {
  try {
    console.log('Starting hotels import...');

    for (const cityGroup of hotelsData) {
      console.log(`\nProcessing city: ${cityGroup.city}`);

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
        console.log(`  ✓ Created hotel: ${hotelData.name} (${hotelId})`);

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
          console.log(`    ✓ Created room type: ${roomData.name}`);

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
              pricingData.extra_services ? JSON.stringify(pricingData.extra_services) : null,
              true
            ]);

            const priceDisplay = pricingData.price_pkr
              ? `PKR ${pricingData.price_pkr.toLocaleString()}`
              : `PKR ${pricingData.price_range_min?.toLocaleString()} - ${pricingData.price_range_max?.toLocaleString()}`;

            console.log(`      ✓ Added pricing: ${priceDisplay}`);
          }
        }
      }
    }

    console.log('\n✅ Hotels import completed successfully!');
  } catch (error) {
    console.error('❌ Error importing hotels:', error);
    process.exit(1);
  }
}

// Run import
importHotels().then(() => {
  console.log('\nImport script finished.');
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
