import { query } from '../utils/database';
import type { AvailabilityMatrix } from '../types';

export const availabilityModel = {
  async getByLeadId(leadId: string) {
    const result = await query('SELECT * FROM availability WHERE lead_id = $1', [leadId]);
    return result.rows[0];
  },

  async upsert(leadId: string, updatedBy: string, data: Partial<AvailabilityMatrix>) {
    const existing = await this.getByLeadId(leadId);

    if (!existing) {
      const insertSql = `
        INSERT INTO availability (
          lead_id, hotel_status, transport_status, guide_status, hold_expiry,
          provider_name, provider_contact, booking_reference, evidence_note, client_approved, updated_by
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
        RETURNING *
      `;

      const insertParams = [
        leadId,
        data.hotelStatus || 'not_checked',
        data.transportStatus || 'not_checked',
        data.guideStatus || 'not_checked',
        data.holdExpiry || null,
        data.providerName || '',
        data.providerContact || '',
        data.bookingReference || '',
        data.evidenceNote || '',
        data.clientApproved || false,
        updatedBy
      ];

      const inserted = await query(insertSql, insertParams);
      return inserted.rows[0];
    }

    const sql = `
      UPDATE availability SET
        hotel_status = $1,
        transport_status = $2,
        guide_status = $3,
        hold_expiry = $4,
        provider_name = $5,
        provider_contact = $6,
        booking_reference = $7,
        evidence_note = $8,
        client_approved = $9,
        updated_by = $10,
        updated_at = NOW()
      WHERE lead_id = $11
      RETURNING *
    `;

    const params = [
      data.hotelStatus || existing.hotel_status || 'not_checked',
      data.transportStatus || existing.transport_status || 'not_checked',
      data.guideStatus || existing.guide_status || 'not_checked',
      data.holdExpiry || existing.hold_expiry || null,
      data.providerName || existing.provider_name || '',
      data.providerContact || existing.provider_contact || '',
      data.bookingReference || existing.booking_reference || '',
      data.evidenceNote || existing.evidence_note || '',
      typeof data.clientApproved === 'boolean' ? data.clientApproved : !!existing.client_approved,
      updatedBy,
      leadId
    ];

    const result = await query(sql, params);
    return result.rows[0];
  },

  canGenerateItinerary(record: any) {
    if (!record) return false;
    return (
      record.hotel_status === 'confirmed' &&
      record.transport_status === 'confirmed' &&
      record.guide_status === 'confirmed'
    );
  },

  canOpenPayment(record: any) {
    if (!record) return false;
    return this.canGenerateItinerary(record) && !!record.client_approved;
  }
};
