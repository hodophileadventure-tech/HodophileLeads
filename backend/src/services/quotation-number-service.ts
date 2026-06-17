import { query } from '../utils/database';

export async function generateQuotationNumber(referenceDate: Date = new Date()): Promise<string> {
  try {
    // Format date as YYMMDD
    const year = String(referenceDate.getFullYear()).slice(-2);
    const month = String(referenceDate.getMonth() + 1).padStart(2, '0');
    const day = String(referenceDate.getDate()).padStart(2, '0');
    const datePrefix = `${year}${month}${day}`;

    // Query to find the highest sequence number for this date
    const result = await query(
      `SELECT quotation_number FROM quote_requests 
       WHERE quotation_number LIKE $1 
       ORDER BY quotation_number DESC 
       LIMIT 1`,
      [`${datePrefix}%`]
    );

    let nextSequence = 1101; // Start from 1101

    if (result.rows.length > 0) {
      const lastNumber = result.rows[0].quotation_number;
      // Extract last 4 digits (the sequence part)
      const lastSequenceStr = lastNumber.slice(-4);
      const lastSequence = parseInt(lastSequenceStr, 10);
      
      if (!isNaN(lastSequence)) {
        nextSequence = lastSequence + 1;
      }
    }

    const quotationNumber = `${datePrefix}${nextSequence}`;
    
    return quotationNumber;
  } catch (error) {
    console.error('Error generating quotation number:', error);
    throw new Error('Failed to generate quotation number');
  }
}
