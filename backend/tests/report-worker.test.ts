jest.mock('../src/utils/database', () => ({
  query: jest.fn()
}));

jest.mock('../src/models/DailyReport', () => ({
  dailyReportsModel: {
    upsert: jest.fn().mockResolvedValue({ id: 'report-1' })
  }
}));

import { query } from '../src/utils/database';
import { dailyReportsModel } from '../src/models/DailyReport';
import { compileReportForUser } from '../src/workers/reportWorker';

describe('report worker follow-up notes', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('includes scheduled and completion notes in follow-up report actions', async () => {
    (query as jest.Mock).mockResolvedValueOnce({
      rows: [{
        entity_type: 'follow_up',
        action: 'complete',
        changes: { completionNotes: 'Client confirmed the travel dates.' },
        created_at: '2026-08-18T10:00:00.000Z',
        follow_up_title: 'Confirm travel dates',
        follow_up_notes: 'Ask about preferred departure time.',
        follow_up_completion_notes: 'Client confirmed the travel dates.',
        follow_up_completed_at: '2026-08-18T10:00:00.000Z'
      }]
    });

    await compileReportForUser('agent-1', 'daily', new Date('2026-08-18T12:00:00.000Z'));

    expect(dailyReportsModel.upsert).toHaveBeenCalledWith(expect.objectContaining({
      reportData: expect.objectContaining({
        actions: [expect.objectContaining({
          followUp: {
            title: 'Confirm travel dates',
            notes: 'Ask about preferred departure time.',
            completionNotes: 'Client confirmed the travel dates.',
            completedAt: '2026-08-18T10:00:00.000Z'
          }
        })]
      })
    }));
  });
});
