require('dotenv').config();
const { Pool } = require('pg');

const shouldUnconfirmLead = (row = {}) => {
  const hotelInfo = row.hotel_info;
  const hotelOptions = row.hotel_options;
  const transportPreference = row.transport_preference;

  const hasCompleteHotel =
    (hotelInfo && hotelInfo.hotelName && hotelInfo.roomType && hotelInfo.checkIn && hotelInfo.checkOut) ||
    (Array.isArray(hotelOptions) && hotelOptions.some((option) =>
      option && option.hotelName && option.roomType && option.checkIn && option.checkOut
    ));

  const hasTransport = typeof transportPreference === 'string' && transportPreference.trim().length > 0;

  return Boolean(
    row &&
    (row.status === 'booked' || row.lead_outcome === 'confirmed' || row.pipeline_stage === 'confirmed') &&
    (!hasCompleteHotel || !hasTransport)
  );
};

const runUnconfirmIncompleteBookings = async () => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  const client = await pool.connect();
  try {
    const columnResult = await client.query(
      `SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'pipeline_stage' LIMIT 1`
    );
    const hasPipelineStage = columnResult.rows.length > 0;

    const query = hasPipelineStage
      ? `SELECT id, hotel_info, hotel_options, transport_preference, status, lead_outcome, pipeline_stage FROM leads WHERE status = 'booked' OR lead_outcome = 'confirmed' OR pipeline_stage = 'confirmed'`
      : `SELECT id, hotel_info, hotel_options, transport_preference, status, lead_outcome FROM leads WHERE status = 'booked' OR lead_outcome = 'confirmed'`;

    const result = await client.query(query);

    let updated = 0;
    for (const row of result.rows) {
      if (!shouldUnconfirmLead(row)) continue;

      const updateSql = hasPipelineStage
        ? `UPDATE leads SET status = 'contacted', lead_outcome = NULL, pipeline_stage = 'contacted', updated_at = NOW() WHERE id = $1`
        : `UPDATE leads SET status = 'contacted', lead_outcome = NULL, updated_at = NOW() WHERE id = $1`;
      await client.query(updateSql, [row.id]);
      updated += 1;
    }

    console.log(`Unconfirmed ${updated} incomplete booked leads.`);
  } catch (error) {
    console.error('Failed to unconfirm incomplete bookings:', error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
};

if (typeof module !== 'undefined') {
  module.exports = { shouldUnconfirmLead, runUnconfirmIncompleteBookings };
}

if (require.main === module) {
  runUnconfirmIncompleteBookings();
}
