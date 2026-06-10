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

  test('accepts a lead payload without travel dates or age', () => {
    const payload = validatePayload(leadSchema, {
      clientName: 'Test User',
      phone: '1234567890',
      destination: 'Bali',
      persons: 2
    } as any);

    expect(payload.clientName).toBe('Test User');
    expect(payload.travelDates).toBeUndefined();
    expect(payload.age).toBeUndefined();
  });

  test('accepts a lead payload with tour type', () => {
    const payload = validatePayload(leadSchema, {
      clientName: 'Test User',
      phone: '1234567890',
      destination: 'Bali',
      tourType: 'Family',
      persons: 2
    } as any);

    expect(payload.tourType).toBe('Family');
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
