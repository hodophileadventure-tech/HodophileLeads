import axios from 'axios';
import { jest } from '@jest/globals';
import { processOutboxEvents, getNextAttemptAt } from '../src/workers/outboxWorker';
import { outboxEventModel } from '../src/models/OutboxEvent';

jest.mock('axios');

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('outbox worker', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  test('sends pending events and marks them completed', async () => {
    const mockEvents = [
      { id: 'event-1', payload: { foo: 'bar' }, retryCount: 0, eventType: 'employee_portal_confirmed_lead' }
    ];

    jest.spyOn(outboxEventModel, 'reservePending').mockResolvedValue(mockEvents as any);
    jest.spyOn(outboxEventModel, 'markCompleted').mockResolvedValue({ id: 'event-1' } as any);
    mockedAxios.post.mockResolvedValue({ status: 200, data: {} });

    await processOutboxEvents();

    expect(outboxEventModel.reservePending).toHaveBeenCalledWith(10);
    expect(mockedAxios.post).toHaveBeenCalledTimes(1);
    expect(outboxEventModel.markCompleted).toHaveBeenCalledWith('event-1');
  });

  test('retries failed events and schedules next attempt', async () => {
    const mockEvents = [
      { id: 'event-2', payload: { foo: 'fail' }, retryCount: 1, eventType: 'employee_portal_confirmed_lead' }
    ];

    jest.spyOn(outboxEventModel, 'reservePending').mockResolvedValue(mockEvents as any);
    jest.spyOn(outboxEventModel, 'markFailed').mockResolvedValue({ id: 'event-2', status: 'pending' } as any);
    mockedAxios.post.mockRejectedValue(new Error('network error'));

    await processOutboxEvents();

    expect(outboxEventModel.reservePending).toHaveBeenCalledWith(10);
    expect(mockedAxios.post).toHaveBeenCalledTimes(1);
    expect(outboxEventModel.markFailed).toHaveBeenCalledWith(
      'event-2',
      expect.stringContaining('network error'),
      expect.any(String),
      2
    );
  });

  test('calculates a valid next attempt timestamp', () => {
    const timestamp = getNextAttemptAt(2);
    expect(new Date(timestamp).getTime()).toBeGreaterThan(Date.now());
  });
});
