import { isEligibleOtherAgent, isUmrahFormName, mapMetaLead } from '../src/services/meta-lead-service';

describe('Meta Lead Ads field mapping', () => {
  it('excludes the selected agents from non-Umrah round-robin assignment', () => {
    expect(isEligibleOtherAgent('Altamash')).toBe(false);
    expect(isEligibleOtherAgent('Joti Ashok')).toBe(false);
    expect(isEligibleOtherAgent('Sameer Khan')).toBe(false);
    expect(isEligibleOtherAgent('Maqsood Khan')).toBe(false);
    expect(isEligibleOtherAgent('Sameer')).toBe(true);
    expect(isEligibleOtherAgent('Ayman Maqsood')).toBe(true);
    expect(isEligibleOtherAgent('Faryha Salman')).toBe(true);
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
});
