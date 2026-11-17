import axios from 'axios';
import { getClient } from '../utils/database';

type MetaField = {
  name: string;
  values?: string[];
};

type MetaLead = {
  id: string;
  created_time?: string;
  form_id?: string;
  field_data?: MetaField[];
};

const fieldValueMap = (fields: MetaField[] = []) => {
  const values = new Map<string, string>();
  for (const field of fields) {
    const value = field.values?.find((item) => typeof item === 'string' && item.trim());
    if (value) {
      values.set(field.name.toLowerCase().replace(/[^a-z0-9]/g, ''), value.trim());
    }
  }
  return values;
};

const getFirstValue = (values: Map<string, string>, ...keys: string[]) => {
  for (const key of keys) {
    const value = values.get(key);
    if (value) return value;
  }
  return undefined;
};

const parseNumber = (value?: string) => {
  if (!value) return undefined;
  const parsed = Number(value.replace(/[^0-9.]/g, ''));
  return Number.isFinite(parsed) ? parsed : undefined;
};

export const mapMetaLead = (metaLead: MetaLead, platform?: string) => {
  const fields = metaLead.field_data || [];
  const values = fieldValueMap(fields);
  const firstName = getFirstValue(values, 'firstname');
  const lastName = getFirstValue(values, 'lastname');
  const clientName = getFirstValue(values, 'fullname', 'name') ||
    [firstName, lastName].filter(Boolean).join(' ') || undefined;
  const phone = getFirstValue(values, 'phonenumber', 'phone', 'mobile', 'mobilenumber', 'whatsappnumber');
  const email = getFirstValue(values, 'email');
  const destination = getFirstValue(values, 'destination', 'traveldestination', 'country', 'destinationcountry') ||
    Array.from(values.entries()).find(([key]) =>
      key.includes('destination') || (key.includes('travel') && !/date|budget|type|duration/.test(key))
    )?.[1];
  const from = getFirstValue(values, 'travelstartdate', 'startdate', 'departuredate', 'dateoftravel');
  const to = getFirstValue(values, 'travelenddate', 'enddate', 'returndate');
  const dates = getFirstValue(values, 'traveldates', 'traveldate', 'dateoftravel');
  const budget = parseNumber(getFirstValue(values, 'budget', 'tripbudget', 'travelbudget'));
  const responses = fields
    .map((field) => `${field.name}: ${(field.values || []).join(', ')}`)
    .filter((response) => response.length > 2)
    .join('\n')
    .slice(0, 10000);
  const createdTime = metaLead.created_time ? new Date(metaLead.created_time) : undefined;

  return {
    clientName,
    email,
    phone,
    destination,
    travelDates: from || to || dates
      ? { from: from || dates || to || '', to: to || dates || from || '' }
      : undefined,
    budget: budget ?? 0,
    source: platform?.toLowerCase() === 'ig' || platform?.toLowerCase() === 'instagram'
      ? 'instagram'
      : 'facebook',
    inquiredAt: createdTime && Number.isFinite(createdTime.getTime()) ? createdTime.toISOString() : undefined,
    remarks: responses ? `Meta Lead Ads form responses:\n${responses}` : 'Imported from Meta Lead Ads.',
  };
};

const fetchMetaLead = async (leadId: string): Promise<MetaLead> => {
  const accessToken = process.env.META_PAGE_ACCESS_TOKEN;
  if (!accessToken) throw new Error('META_PAGE_ACCESS_TOKEN is not configured');

  const version = process.env.META_GRAPH_API_VERSION || 'v24.0';
  if (!/^v\d+\.\d+$/.test(version)) throw new Error('META_GRAPH_API_VERSION must look like v24.0');

  try {
    const response = await axios.get<MetaLead>(`https://graph.facebook.com/${version}/${leadId}`, {
      params: {
        access_token: accessToken,
        fields: 'id,created_time,form_id,field_data',
      },
      timeout: 10000,
    });
    return response.data;
  } catch (error) {
    const status = axios.isAxiosError(error) ? error.response?.status : undefined;
    throw new Error(`Meta Graph API could not retrieve lead ${leadId}${status ? ` (HTTP ${status})` : ''}`);
  }
};

export const importMetaLead = async (leadId: string, pageId: string, formId?: string, platform?: string) => {
  if (!/^\d+$/.test(leadId)) throw new Error('Meta lead ID is invalid');

  const metaLead = await fetchMetaLead(leadId);
  const lead = mapMetaLead(metaLead, platform);
  if (!lead.phone) {
    throw new Error(`Meta lead ${leadId} has no phone number; include a phone field in the Meta form`);
  }

  const agentId = process.env.META_DEFAULT_AGENT_ID;
  if (!agentId) throw new Error('META_DEFAULT_AGENT_ID is not configured');

  const client = await getClient();
  try {
    await client.query('BEGIN');

    const claim = await client.query(
      `INSERT INTO meta_lead_imports (meta_lead_id, page_id, form_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (meta_lead_id) DO NOTHING
       RETURNING meta_lead_id`,
      [leadId, pageId, formId || metaLead.form_id || null]
    );
    if (claim.rowCount === 0) {
      await client.query('COMMIT');
      return { imported: false, duplicate: true };
    }

    const agent = await client.query(
      "SELECT id FROM users WHERE id = $1 AND role = 'agent'",
      [agentId]
    );
    if (agent.rowCount === 0) throw new Error('META_DEFAULT_AGENT_ID must identify an existing agent');

    const profileResult = await client.query(
      `INSERT INTO client_profiles (phone, name, email)
       VALUES ($1, $2, $3)
       ON CONFLICT (phone) DO UPDATE SET
         name = COALESCE(client_profiles.name, EXCLUDED.name),
         email = COALESCE(client_profiles.email, EXCLUDED.email),
         updated_at = CURRENT_TIMESTAMP
       RETURNING id`,
      [lead.phone, lead.clientName || null, lead.email || null]
    );

    const insertedLead = await client.query(
      `INSERT INTO leads (
         client_name, email, phone, destination, travel_dates, source, temperature,
         status, budget, persons, agent_id, profile_id, remarks, inquired_at
       ) VALUES ($1, $2, $3, $4, $5::jsonb, $6, 'warm', 'new', $7, 1, $8, $9, $10, $11)
       RETURNING id`,
      [
        lead.clientName || null,
        lead.email || null,
        lead.phone,
        lead.destination || null,
        lead.travelDates ? JSON.stringify(lead.travelDates) : null,
        lead.source,
        lead.budget,
        agentId,
        profileResult.rows[0].id,
        lead.remarks,
        lead.inquiredAt || null,
      ]
    );

    await client.query(
      'UPDATE meta_lead_imports SET lead_id = $1 WHERE meta_lead_id = $2',
      [insertedLead.rows[0].id, leadId]
    );
    await client.query('COMMIT');
    return { imported: true, duplicate: false, leadId: insertedLead.rows[0].id };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};
