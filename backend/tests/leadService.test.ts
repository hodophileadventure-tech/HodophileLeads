import { calculateBookingHealthScore, generateFollowUpTasks } from '../src/services/lead-service';

describe('lead service helpers', () => {
  test('computes a strong booking health score for complete factors', () => {
    const result = calculateBookingHealthScore({
      tripleLockComplete: true,
      clientApproved: true,
      paymentReceived: true,
      preDepartureTasksDone: true
    });

    expect(result.score).toBe(100);
    expect(result.health).toBe('green');
  });

  test('generates follow-up tasks for booking confirmed', async () => {
    const tasks = await generateFollowUpTasks('lead-1', 'booking_confirmed');

    expect(tasks.length).toBeGreaterThan(0);
    expect(tasks[0].leadId).toBe('lead-1');
    expect(tasks[0].type).toBe('auto');
  });
});
