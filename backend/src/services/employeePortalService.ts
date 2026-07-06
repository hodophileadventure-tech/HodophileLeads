import { Lead } from '../types';
import { query } from '../utils/database';
import { outboxEventModel } from '../models/OutboxEvent';

const EVENT_TYPE = 'employee_portal_confirmed_lead';

const getAgentEmail = async (agentId: string) => {
  const result = await query('SELECT email FROM users WHERE id = $1', [agentId]);
  return result.rows?.[0]?.email || null;
};

const getCommissionRate = () => {
  const raw = process.env.EMPLOYEE_PORTAL_COMMISSION_RATE ?? '0.1';
  const parsed = Number(raw);
  if (Number.isNaN(parsed) || parsed < 0) {
    return 0.1;
  }
  return Math.min(1, parsed);
};

const buildConfirmedLeadPayload = async (lead: Lead) => {
  const leadWorth = Number(lead.actualPrice ?? lead.latestRevisedPrice ?? lead.initialPrice ?? 0);
  const rate = getCommissionRate();
  const commission = Number((leadWorth * rate).toFixed(2));
  const agentEmail = lead.agentId ? await getAgentEmail(String(lead.agentId)) : null;

  return {
    leadId: lead.id,
    employeeId: String(lead.agentId),
    employeeEmail: agentEmail,
    customerName: lead.clientName || '',
    customerNumber: lead.phone || '',
    destination: lead.destination || '',
    persons: Number(lead.persons || 1),
    leadWorth,
    commission,
    sourceSystem: 'lead-manager',
    confirmedAt: new Date().toISOString()
  };
};

export const enqueueConfirmedLeadNotification = async (lead: Lead, client?: any) => {
  const payload = await buildConfirmedLeadPayload(lead);
  const externalId = `${EVENT_TYPE}:${lead.id}`;
  return outboxEventModel.create({
    eventType: EVENT_TYPE,
    payload,
    externalId,
    nextAttemptAt: new Date().toISOString()
  }, client);
};
