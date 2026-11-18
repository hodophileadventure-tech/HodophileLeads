import axios from 'axios';
import { getClient, query } from '../utils/database';

type MetaField = {
  name: string;
  values?: string[];
};

export type MetaLead = {
  id: string;
  created_time?: string;
  form_id?: string;
  platform?: string;
  ad_id?: string;
  field_data?: MetaField[];
};

type MetaLeadForm = {
  id: string;
  name?: string;
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

export const normalizeMetaPhone = (value?: string) => {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (/^<\s*test lead:/i.test(trimmed)) return undefined;
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 19) return undefined;

  const normalized = `${trimmed.startsWith('+') ? '+' : ''}${digits}`;
  return normalized.length <= 20 ? normalized : undefined;
};

export const normalizeMetaPlatform = (platform?: string) => {
  const normalized = platform?.trim().toLowerCase();
  if (!normalized) return undefined;
  if (normalized === 'ig' || normalized === 'instagram') return 'instagram';
  if (normalized === 'fb' || normalized === 'facebook') return 'facebook';
  return undefined;
};

export const inferMetaPlatformFromAd = (ad: any): string | undefined => {
  const creative = ad?.creative || {};
  const objectStory = creative.object_story_spec || {};
  const targetingPlatforms = ad?.adset?.targeting?.publisher_platforms;
  if (
    creative.instagram_actor_id ||
    creative.effective_instagram_media_id ||
    creative.instagram_story_id ||
    objectStory.instagram_actor_id ||
    (Array.isArray(targetingPlatforms) &&
      targetingPlatforms.length === 1 &&
      String(targetingPlatforms[0]).toLowerCase() === 'instagram')
  ) {
    return 'instagram';
  }

  if (
    Array.isArray(targetingPlatforms) &&
    targetingPlatforms.length === 1 &&
    String(targetingPlatforms[0]).toLowerCase() === 'facebook'
  ) {
    return 'facebook';
  }
  return undefined;
};

export const mapMetaLead = (metaLead: MetaLead, platform?: string) => {
  const fields = metaLead.field_data || [];
  const values = fieldValueMap(fields);
  const firstName = getFirstValue(values, 'firstname');
  const lastName = getFirstValue(values, 'lastname');
  const clientName = getFirstValue(values, 'fullname', 'name') ||
    [firstName, lastName].filter(Boolean).join(' ') || undefined;
  const phone = normalizeMetaPhone(
    getFirstValue(values, 'phonenumber', 'phone', 'mobile', 'mobilenumber', 'whatsappnumber')
  );
  const email = getFirstValue(values, 'email');
  const destination = getFirstValue(
    values,
    'destination',
    'traveldestination',
    'destinationcountry',
  ) ||
    Array.from(values.entries()).find(([key]) =>
      key.includes('destination') || /^(where|which|what).*(travel|trip|visit|go)/.test(key)
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
  const source = normalizeMetaPlatform(platform) ||
    normalizeMetaPlatform(metaLead.platform) ||
    'facebook';

  return {
    clientName,
    email,
    phone,
    destination,
    travelDates: from || to || dates
      ? { from: from || dates || to || '', to: to || dates || from || '' }
      : undefined,
    budget: budget ?? 0,
    source,
    inquiredAt: createdTime && Number.isFinite(createdTime.getTime()) ? createdTime.toISOString() : undefined,
    remarks: responses ? `Meta Lead Ads form responses:\n${responses}` : 'Imported from Meta Lead Ads.',
  };
};

export const isUmrahFormName = (formName: string) => formName.toLowerCase().includes('umrah');

const excludedOtherAgentNames = ['altamash', 'joti ashok', 'sameer khan', 'maqsood khan', 'test'];

export const isEligibleOtherAgent = (name: string, roleSlug: string | null | undefined) =>
  roleSlug?.trim().toLowerCase() === 'agent' &&
  !excludedOtherAgentNames.includes(name.trim().toLowerCase());

export class MetaLeadImportError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
    readonly authError = false
  ) {
    super(message);
    this.name = 'MetaLeadImportError';
  }
}

export const isRetryableMetaGraphError = (status?: number, graphCode?: number) =>
  graphCode === 190 || status === undefined || status === 429 || status >= 500;

const graphApiGet = async <T>(objectId: string, fields: string): Promise<T> => {
  const accessToken = process.env.META_PAGE_ACCESS_TOKEN;
  if (!accessToken) throw new MetaLeadImportError('META_PAGE_ACCESS_TOKEN is not configured', false);

  const version = process.env.META_GRAPH_API_VERSION || 'v27.0';
  if (!/^v\d+\.\d+$/.test(version)) {
    throw new MetaLeadImportError('META_GRAPH_API_VERSION must look like v27.0', false);
  }

  try {
    const response = await axios.get<T>(`https://graph.facebook.com/${version}/${objectId}`, {
      params: {
        access_token: accessToken,
        fields,
      },
      timeout: 10000,
    });
    return response.data;
  } catch (error) {
    const status = axios.isAxiosError(error) ? error.response?.status : undefined;
    const graphError = axios.isAxiosError(error) ? error.response?.data?.error : undefined;
    const details = graphError?.message ? `: ${graphError.message}` : '';
    const code = graphError?.code
      ? ` (Meta code ${graphError.code}${graphError.error_subcode ? `/${graphError.error_subcode}` : ''})`
      : '';
    const authError = Number(graphError?.code) === 190;
    const retryable = isRetryableMetaGraphError(status, Number(graphError?.code));
    throw new MetaLeadImportError(
      `Meta Graph API could not retrieve ${objectId}${status ? ` (HTTP ${status})` : ''}${details}${code}`,
      retryable,
      authError
    );
  }
};

export const fetchMetaLeadById = (leadId: string) =>
  graphApiGet<MetaLead>(leadId, 'id,created_time,form_id,field_data,platform,ad_id');

export const resolveMetaLeadPlatform = async (
  metaLead: MetaLead,
  webhookPlatform?: string
) => {
  const explicitPlatform = normalizeMetaPlatform(webhookPlatform) ||
    normalizeMetaPlatform(metaLead.platform);
  if (explicitPlatform) return explicitPlatform;
  if (!metaLead.ad_id) return 'facebook';

  try {
    const ad = await graphApiGet<any>(
      metaLead.ad_id,
      'creative{effective_instagram_media_id,instagram_actor_id,instagram_story_id,object_story_spec},adset{targeting}'
    );
    return inferMetaPlatformFromAd(ad) || 'facebook';
  } catch {
    return 'facebook';
  }
};

export const isRetryableMetaLeadError = (error: unknown) => {
  if (error instanceof MetaLeadImportError) return error.retryable;
  const code = typeof error === 'object' && error && 'code' in error
    ? String((error as { code?: unknown }).code || '')
    : '';
  if (code.startsWith('22') || code.startsWith('23')) return false;
  return true;
};

export const isMetaLeadAuthError = (error: unknown) =>
  error instanceof MetaLeadImportError && error.authError;

const getNextOtherAgentId = async (client: any, umrahAgentId: string) => {
  await client.query(
    `INSERT INTO meta_lead_assignment_state (assignment_key, last_agent_id)
     VALUES ('other_forms', NULL)
     ON CONFLICT (assignment_key) DO NOTHING`
  );
  const state = await client.query(
    `SELECT last_agent_id
     FROM meta_lead_assignment_state
     WHERE assignment_key = 'other_forms'
     FOR UPDATE`
  );
  const agents = await client.query(
    `SELECT u.id, u.name, r.slug AS role_slug
     FROM users u
     LEFT JOIN roles r ON r.id = u.role_id
     WHERE u.role = 'agent'
       AND u.id <> $1
     ORDER BY u.id`,
    [umrahAgentId]
  );
  const eligibleAgents = agents.rows.filter((row: { name: string; role_slug: string | null }) =>
    isEligibleOtherAgent(row.name, row.role_slug)
  );
  if (eligibleAgents.length === 0) {
    throw new Error('No other CRM agents are available for non-Umrah leads');
  }

  const agentIds = eligibleAgents.map((row: { id: string }) => String(row.id));
  const lastIndex = agentIds.indexOf(String(state.rows[0].last_agent_id || ''));
  const nextAgentId = agentIds[(lastIndex + 1) % agentIds.length];
  await client.query(
    `UPDATE meta_lead_assignment_state
     SET last_agent_id = $1, updated_at = CURRENT_TIMESTAMP
     WHERE assignment_key = 'other_forms'`,
    [nextAgentId]
  );
  return nextAgentId;
};

export const importMetaLead = async (
  leadId: string,
  pageId: string,
  formId?: string,
  platform?: string,
  cachedMetaLead?: MetaLead
) => {
  if (!/^\d+$/.test(leadId)) throw new MetaLeadImportError('Meta lead ID is invalid', false);
  if (formId && !/^\d+$/.test(formId)) throw new MetaLeadImportError('Meta form ID is invalid', false);

  const metaLead = cachedMetaLead || await fetchMetaLeadById(leadId);
  const resolvedPlatform = await resolveMetaLeadPlatform(metaLead, platform);

  const existingImport = await query(
    'SELECT lead_id FROM meta_lead_imports WHERE meta_lead_id = $1',
    [leadId]
  );
  if (existingImport.rows.length > 0) {
    if (existingImport.rows[0].lead_id) {
      await query(
        'UPDATE leads SET source = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [resolvedPlatform, existingImport.rows[0].lead_id]
      );
    }
    return { imported: false, duplicate: true };
  }

  const lead = mapMetaLead(metaLead, resolvedPlatform);
  if (!lead.phone) {
    throw new MetaLeadImportError(`Meta lead ${leadId} has no valid phone number`, false);
  }

  const umrahAgentId = process.env.META_UMRAH_AGENT_ID;
  if (!umrahAgentId) throw new Error('META_UMRAH_AGENT_ID is not configured');
  const resolvedFormId = formId || metaLead.form_id;
  const form = resolvedFormId
    ? await graphApiGet<MetaLeadForm>(resolvedFormId, 'id,name')
    : undefined;
  const isUmrah = Boolean(form?.name && isUmrahFormName(form.name));

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

    let agentId: string;
    if (isUmrah) {
      const agent = await client.query(
        `SELECT u.id
         FROM users u
         JOIN roles r ON r.id = u.role_id
         WHERE u.id = $1 AND r.slug = 'agent'`,
        [umrahAgentId]
      );
      if (agent.rowCount === 0) throw new Error('META_UMRAH_AGENT_ID must identify an existing agent');
      agentId = String(agent.rows[0].id);
    } else {
      agentId = await getNextOtherAgentId(client, umrahAgentId);
    }

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
