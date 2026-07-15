require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

(async () => {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT id, hotel_info, hotel_options, transport_preference, status, lead_outcome, pipeline_stage
      FROM leads
      WHERE status = 'booked' OR lead_outcome = 'confirmed' OR pipeline_stage = 'confirmed'
    `);

    let updated = 0;
    for (const row of result.rows) {
      const hotelInfo = row.hotel_info;
      const hotelOptions = row.hotel_options;
      const transportPreference = row.transport_preference;

      const hasCompleteHotel =
        (hotelInfo && hotelInfo.hotelName && hotelInfo.roomType && hotelInfo.checkIn && hotelInfo.checkOut) ||
        (Array.isArray(hotelOptions) && hotelOptions.some((option) =>
          option && option.hotelName && option.roomType && option.checkIn && option.checkOut
        ));

      const hasTransport = typeof transportPreference === 'string' && transportPreference.trim().length > 0;

      if (!hasCompleteHotel || !hasTransport) {
        await client.query(
          `UPDATE leads SET status = 'contacted', lead_outcome = NULL, pipeline_stage = 'contacted', updated_at = NOW() WHERE id = $1`,
          [row.id]
        );
        updated += 1;
      }
    }

    console.log(`Unconfirmed ${updated} incomplete booked leads.`);
  } catch (error) {
    console.error('Failed to unconfirm incomplete bookings:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
})();
