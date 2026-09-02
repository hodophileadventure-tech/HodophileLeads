import { leadsModel } from '../src/models/Lead';
import { query } from '../src/utils/database';

const { shouldUnconfirmLead } = require('../scripts/unconfirm-incomplete-bookings');

jest.mock('../src/utils/database', () => ({
  query: jest.fn(),
  getClient: jest.fn()
}));

describe('Lead model update', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('persists confirmation updates including the B2B flag', async () => {
    (query as jest.Mock).mockResolvedValue({
      rows: [{ id: 'lead-1', isB2b: true, status: 'booked', lead_outcome: 'confirmed', pipeline_stage: 'confirmed' }]
    });

    await leadsModel.update('lead-1', {
      pipelineStage: 'confirmed',
      potential: false,
      isB2b: true
    } as any);

    const [sql, params] = (query as jest.Mock).mock.calls.at(-1);
    expect(sql).toContain('is_b2b');
    expect(sql).toContain('pipeline_stage');
    expect(params).toContain(true);
  });

  it('does not reopen a completed lead from a stale form update', async () => {
    (query as jest.Mock)
      .mockResolvedValueOnce({ rows: [{ id: 'lead-1', status: 'completed', temperature: 'dead', has_progressed: true }] })
      .mockResolvedValueOnce({ rows: [{ id: 'lead-1', status: 'completed', temperature: 'dead' }] });

    await leadsModel.update('lead-1', {
      clientName: 'Updated name',
      status: 'contacted',
      agentRemarks: 'Unrelated note'
    } as any);

    const [sql, params] = (query as jest.Mock).mock.calls.at(-1);
    expect(sql).toContain('status = $');
    expect(params).toContain('completed');
    expect(params).not.toContain('contacted');
  });

  it('does not auto-unconfirm a completed booking when hotel and transport are present', () => {
    const lead = {
      status: 'booked',
      lead_outcome: 'confirmed',
      pipeline_stage: 'confirmed',
      hotel_info: { hotelName: 'Lake View', roomType: 'Deluxe', checkIn: '2026-09-01', checkOut: '2026-09-05' },
      transport_preference: 'Private car'
    };

    expect(shouldUnconfirmLead(lead)).toBe(false);
  });

  it('auto-unconfirms incomplete bookings that are missing required travel details', () => {
    const lead = {
      status: 'booked',
      lead_outcome: 'confirmed',
      pipeline_stage: 'confirmed',
      hotel_info: { hotelName: 'Lake View' },
      transport_preference: ''
    };

    expect(shouldUnconfirmLead(lead)).toBe(true);
  });
});
