import { validatePayload, paymentSchema, leadSchema, followUpSchema } from '../src/utils/validation';

describe('validation helpers', () => {
  test('accepts a valid payment payload', () => {
    const payload = validatePayload(paymentSchema, {
      leadId: '123e4567-e89b-12d3-a456-426614174000',
      amount: 25000,
      method: 'cash',
      dueDate: new Date().toISOString(),
      notes: 'deposit'
    });

    expect(payload.amount).toBe(25000);
    expect(payload.method).toBe('cash');
  });

  test('rejects invalid lead payloads', () => {
    expect(() => validatePayload(leadSchema, {
      clientName: '',
      email: 'bad-email',
      phone: '123',
      destination: '',
      travelDates: { from: '', to: '' },
      persons: 0,
      budget: -1,
      source: 'web'
    } as any)).toThrow();
  });

  test('accepts a follow-up reminder payload', () => {
    const payload = validatePayload(followUpSchema, {
      leadId: '123e4567-e89b-12d3-a456-426614174000',
      title: 'Call client',
      dueDate: new Date().toISOString(),
      priority: 'high'
    });

    expect(payload.title).toBe('Call client');
    expect(payload.priority).toBe('high');
  });
});
