import { describe, expect, it } from 'vitest';
import { buildLeadFormState } from './LeadForm';

describe('buildLeadFormState', () => {
  it('hydrates lead data without resetting the form on unrelated parent updates', () => {
    const form = buildLeadFormState({
      id: 'lead-1',
      clientName: 'Ali Khan',
      email: 'ali@example.com',
      phone: '03001234567',
      address: 'Lahore',
      gender: 'male',
      source: 'whatsapp',
      islamabadStay: true,
      destination: 'Dubai',
      travelDates: { from: '2026-10-05', to: '2026-10-12' },
      createdAt: '2026-08-15T00:00:00.000Z',
      adults: 2,
      kids: 1,
      tourType: 'private',
      agentRemarks: 'VIP',
      remarks: 'Needs visa',
      tripBudget: 500000,
      potential: true,
      status: 'new',
      pipelineStage: 'new'
    });

    expect(form.clientName).toBe('Ali Khan');
    expect(form.islamabadStay).toBe('yes');
    expect(form.leadStatus).toBe('potential');
    expect(form.adults).toBe(2);
    expect(form.kids).toBe(1);
  });

  it('creates a blank form state for a new lead', () => {
    const form = buildLeadFormState();

    expect(form.clientName).toBe('');
    expect(form.leadStatus).toBe('new');
    expect(form.travelDates).toEqual({ from: '', to: '' });
  });
});
