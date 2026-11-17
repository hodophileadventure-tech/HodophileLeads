jest.mock('../src/models/MetaLeadWebhookEvent', () => ({
  metaLeadWebhookEventModel: {
    reservePending: jest.fn(),
    saveLeadPayload: jest.fn(),
    markCompleted: jest.fn(),
    scheduleRetry: jest.fn(),
    markFailed: jest.fn(),
  },
}));

jest.mock('../src/services/meta-lead-service', () => ({
  fetchMetaLeadById: jest.fn(),
  importMetaLead: jest.fn(),
  isRetryableMetaLeadError: jest.fn((error: { retryable?: boolean }) => error.retryable !== false),
}));

import { metaLeadWebhookEventModel } from '../src/models/MetaLeadWebhookEvent';
import { fetchMetaLeadById, importMetaLead } from '../src/services/meta-lead-service';
import { getMetaLeadRetryDelayMs, processMetaLeadEvents } from '../src/workers/metaLeadWorker';

const mockedModel = metaLeadWebhookEventModel as jest.Mocked<typeof metaLeadWebhookEventModel>;
const mockedFetchMetaLead = fetchMetaLeadById as jest.MockedFunction<typeof fetchMetaLeadById>;
const mockedImportMetaLead = importMetaLead as jest.MockedFunction<typeof importMetaLead>;

const event = {
  metaLeadId: '12345',
  pageId: '67890',
  formId: '11223',
  platform: 'fb',
  leadPayload: null,
  retryCount: 1,
};

describe('Meta lead webhook worker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('persists fetched lead data before importing and marks successful events complete', async () => {
    const payload = { id: '12345', field_data: [] };
    mockedModel.reservePending.mockResolvedValue([event]);
    mockedFetchMetaLead.mockResolvedValue(payload);
    mockedImportMetaLead.mockResolvedValue({ imported: true, duplicate: false, leadId: 'crm-lead-id' });

    await processMetaLeadEvents();

    expect(mockedModel.saveLeadPayload).toHaveBeenCalledWith('12345', payload);
    expect(mockedImportMetaLead).toHaveBeenCalledWith('12345', '67890', '11223', 'fb', payload);
    expect(mockedModel.markCompleted).toHaveBeenCalledWith('12345');
  });

  it('schedules transient failures for retry', async () => {
    mockedModel.reservePending.mockResolvedValue([{ ...event, leadPayload: { id: '12345' } }]);
    mockedImportMetaLead.mockRejectedValue(new Error('temporary network error'));

    await processMetaLeadEvents();

    expect(mockedModel.scheduleRetry).toHaveBeenCalledWith(
      '12345',
      'temporary network error',
      expect.any(String)
    );
    expect(mockedModel.markFailed).not.toHaveBeenCalled();
  });

  it('records permanent failures without retrying and caps exponential backoff', async () => {
    mockedModel.reservePending.mockResolvedValue([{ ...event, leadPayload: { id: '12345' } }]);
    const invalidPhoneError = new Error('invalid phone') as Error & { retryable: boolean };
    invalidPhoneError.retryable = false;
    mockedImportMetaLead.mockRejectedValue(invalidPhoneError);

    await processMetaLeadEvents();

    expect(mockedModel.markFailed).toHaveBeenCalledWith('12345', 'invalid phone');
    expect(mockedModel.scheduleRetry).not.toHaveBeenCalled();
    expect(getMetaLeadRetryDelayMs(1)).toBe(30000);
    expect(getMetaLeadRetryDelayMs(99)).toBe(3600000);
  });

  it('moves transient failures to the failed state after the retry limit', async () => {
    mockedModel.reservePending.mockResolvedValue([
      { ...event, leadPayload: { id: '12345' }, retryCount: 8 },
    ]);
    mockedImportMetaLead.mockRejectedValue(new Error('still unavailable'));

    await processMetaLeadEvents();

    expect(mockedModel.markFailed).toHaveBeenCalledWith('12345', 'still unavailable');
    expect(mockedModel.scheduleRetry).not.toHaveBeenCalled();
  });
});
