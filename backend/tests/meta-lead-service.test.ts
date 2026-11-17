import {
  isEligibleOtherAgent,
  isUmrahFormName,
  mapMetaLead,
  normalizeMetaPhone,
} from '../src/services/meta-lead-service';

describe('Meta Lead Ads field mapping', () => {
  it('excludes the selected agents from non-Umrah round-robin assignment', () => {
    expect(isEligibleOtherAgent('Altamash', 'agent')).toBe(false);
    expect(isEligibleOtherAgent('Joti Ashok', 'agent')).toBe(false);
    expect(isEligibleOtherAgent('Sameer Khan', 'agent')).toBe(false);
    expect(isEligibleOtherAgent('Maqsood Khan', 'agent')).toBe(false);
    expect(isEligibleOtherAgent('Sameer', 'agent')).toBe(true);
    expect(isEligibleOtherAgent('Ayman Maqsood', 'agent')).toBe(true);
    expect(isEligibleOtherAgent('Faryha Salman', 'agent')).toBe(true);
    expect(isEligibleOtherAgent('Samik', 'video_editor')).toBe(false);
    expect(isEligibleOtherAgent('A creative user', 'content_creator')).toBe(false);
  });

  it('identifies Umrah forms by their form name', () => {
    expect(isUmrahFormName('Umrah Form-777')).toBe(true);
    expect(isUmrahFormName('New 7 Nov 2026-copy')).toBe(false);
  });

  it('maps common Meta form fields into a new CRM lead', () => {
    const lead = mapMetaLead({
      id: '12345',
      created_time: '2026-11-17T10:00:00+0000',
      form_id: 'form-1',
      field_data: [
        { name: 'full_name', values: ['Avery Sample'] },
        { name: 'phone_number', values: ['+31123456789'] },
        { name: 'email', values: ['avery@example.com'] },
        { name: 'Where would you like to travel?', values: ['Japan'] },
        { name: 'Travel budget', values: ['€2,500'] },
      ],
    }, 'ig');

    expect(lead).toMatchObject({
      clientName: 'Avery Sample',
      phone: '+31123456789',
      email: 'avery@example.com',
      destination: 'Japan',
      budget: 2500,
      source: 'instagram',
    });
    expect(lead.remarks).toContain('Where would you like to travel?: Japan');
    expect(lead.inquiredAt).toBe('2026-11-17T10:00:00.000Z');
  });

  it('combines first and last name and uses Facebook as the default source', () => {
    const lead = mapMetaLead({
      id: '12345',
      field_data: [
        { name: 'first_name', values: ['Taylor'] },
        { name: 'last_name', values: ['Person'] },
        { name: 'phone', values: ['123456789'] },
      ],
    });

    expect(lead.clientName).toBe('Taylor Person');
    expect(lead.source).toBe('facebook');
  });

  it('normalizes valid phone numbers and rejects Meta test placeholders instead of truncating', () => {
    expect(normalizeMetaPhone('+31 (0) 6 1234 5678')).toBe('+310612345678');
    expect(normalizeMetaPhone('<test lead: dummy data for whatsapp_number>')).toBeUndefined();
    expect(normalizeMetaPhone('123456789012345678901')).toBeUndefined();
  });

  it('does not use a home city or traveler count as the travel destination', () => {
    const lead = mapMetaLead({
      id: '12345',
      field_data: [
        { name: 'how_many_people_are_travelling?', values: ['2_people'] },
        { name: 'city', values: ['Karachi'] },
      ],
    });

    expect(lead.destination).toBeUndefined();
  });

  it('does not use a traveler-count answer as destination when no destination field exists', () => {
    const lead = mapMetaLead({
      id: '12345',
      field_data: [
        { name: 'how_many_people_are_travelling?', values: ['2_people'] },
      ],
    });

    expect(lead.destination).toBeUndefined();
  });

  it('maps an explicit travel question to the requested destination', () => {
    const lead = mapMetaLead({
      id: '12345',
      field_data: [
        { name: 'where_would_you_like_to_travel?', values: ['Hunza'] },
      ],
    });

    expect(lead.destination).toBe('Hunza');
  });
});
