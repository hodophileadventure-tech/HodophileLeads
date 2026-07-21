import { leadsModel } from '../src/models/Lead';
import { query } from '../src/utils/database';

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

    const [sql, params] = (query as jest.Mock).mock.calls[0];
    expect(sql).toContain('is_b2b');
    expect(sql).toContain('pipeline_stage');
    expect(params).toContain(true);
  });
});
