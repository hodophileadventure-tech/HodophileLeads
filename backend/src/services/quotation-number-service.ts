import { query } from '../utils/database';

export async function generateQuotationNumber(referenceDate: Date = new Date()): Promise<string> {
  try {
    // Format date as YYMMDD
    const year = String(referenceDate.getFullYear()).slice(-2);
    const month = String(referenceDate.getMonth() + 1).padStart(2, '0');
    const day = String(referenceDate.getDate()).padStart(2, '0');
    const datePrefix = `${year}${month}${day}`;

    // Thread-safe atomic increment using UPSERT pattern
    // This ensures that even with concurrent requests, each gets a unique number
    const result = await query(
      `WITH upserted AS (
        INSERT INTO quotation_counters (date_key, last_sequence, updated_at)
        VALUES ($1, 1100, NOW())
        ON CONFLICT (date_key) 
        DO UPDATE SET last_sequence = quotation_counters.last_sequence + 1, updated_at = NOW()
        RETURNING last_sequence
      )
      SELECT last_sequence FROM upserted`,
      [datePrefix]
    );

    // The RETURNING gives us the updated value
    // On first call: insert 1100, return 1100, add 1 → 1101 ✓
    // On second call: update to 1101, return 1101, add 1 → 1102 ✓
    const lastSequence = result.rows[0].last_sequence;
    const nextSequence = lastSequence + 1;
    const quotationNumber = `${datePrefix}${nextSequence}`;
    
    return quotationNumber;
  } catch (error) {
    console.error('Error generating quotation number:', error);
    throw new Error('Failed to generate quotation number');
  }
}
