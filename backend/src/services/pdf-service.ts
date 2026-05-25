import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { leadsModel } from '../models/Lead';
import { availabilityModel } from '../models/Availability';
import { query } from '../utils/database';

export async function generateItineraryPdfBuffer(leadId: string) {
  const lead = await leadsModel.findById(leadId);
  const availability = await availabilityModel.getByLeadId(leadId);
  const payments = (await query('SELECT * FROM payments WHERE lead_id = $1', [leadId])).rows;

  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]); // A4-ish
  const timesRomanFont = await doc.embedFont(StandardFonts.Helvetica);

  const { width, height } = page.getSize();
  const left = 50;
  let y = height - 60;

  page.drawText('TRIPNEXUS - Itinerary', {
    x: left,
    y,
    size: 20,
    font: timesRomanFont,
    color: rgb(0.05, 0.45, 0.70)
  });

  y -= 30;
  page.drawText(`Client: ${lead?.client_name || lead?.clientName || 'Unknown'}`, { x: left, y, size: 12, font: timesRomanFont });
  y -= 18;
  page.drawText(`Destination: ${lead?.destination || 'N/A'}`, { x: left, y, size: 12, font: timesRomanFont });
  y -= 18;
  page.drawText(`Travel Dates: ${JSON.stringify(lead?.travel_dates || lead?.travelDates || '')}`, { x: left, y, size: 11, font: timesRomanFont });
  y -= 22;

  const hotelInfoRaw = lead?.hotel_info || lead?.hotelInfo;
  const hotelInfo = typeof hotelInfoRaw === 'string' ? JSON.parse(hotelInfoRaw) : hotelInfoRaw;
  if (hotelInfo) {
    page.drawText('Hotel Details:', { x: left, y, size: 13, font: timesRomanFont });
    y -= 16;
    page.drawText(`Hotel Name: ${hotelInfo.hotelName || hotelInfo.name || 'N/A'}`, { x: left + 10, y, size: 11, font: timesRomanFont });
    y -= 14;
    page.drawText(`Room Type: ${hotelInfo.roomType || 'N/A'}`, { x: left + 10, y, size: 11, font: timesRomanFont });
    y -= 14;
    page.drawText(`Room Price: ${hotelInfo.roomPrice ?? hotelInfo.price ?? 'N/A'}`, { x: left + 10, y, size: 11, font: timesRomanFont });
    y -= 20;
  }

  page.drawText('Availability (Triple-Lock):', { x: left, y, size: 13, font: timesRomanFont });
  y -= 16;
  page.drawText(`Hotel: ${availability?.hotel_status || 'not_checked'}`, { x: left + 10, y, size: 11, font: timesRomanFont });
  y -= 14;
  page.drawText(`Transport: ${availability?.transport_status || 'not_checked'}`, { x: left + 10, y, size: 11, font: timesRomanFont });
  y -= 14;
  page.drawText(`Guide: ${availability?.guide_status || 'not_checked'}`, { x: left + 10, y, size: 11, font: timesRomanFont });
  y -= 20;

  page.drawText('Payments:', { x: left, y, size: 13, font: timesRomanFont });
  y -= 16;
  if (payments.length === 0) {
    page.drawText('No payments recorded', { x: left + 10, y, size: 11, font: timesRomanFont });
    y -= 14;
  } else {
    for (const p of payments) {
      page.drawText(`- ${p.amount} (${p.status}) on ${p.payment_date || p.created_at}`, { x: left + 10, y, size: 11, font: timesRomanFont });
      y -= 14;
      if (y < 80) {
        y = height - 60;
        doc.addPage([595, 842]);
      }
    }
  }

  y -= 8;
  page.drawText('Notes:', { x: left, y, size: 13, font: timesRomanFont });
  y -= 14;
  page.drawText(`${lead?.special_requests || lead?.specialRequests || 'None'}`, { x: left + 10, y, size: 11, font: timesRomanFont });

  const pdfBytes = await doc.save();
  return Buffer.from(pdfBytes);
}

export default {
  generateItineraryPdfBuffer
};
