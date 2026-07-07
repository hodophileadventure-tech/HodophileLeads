import { Lead } from '../types';
import { query } from '../utils/database';
import { outboxEventModel } from '../models/OutboxEvent';
import { calculateCommission, getRuleDescription } from './commissionRuleService';

const EVENT_TYPE = 'employee_portal_confirmed_lead';

const getAgentEmail = async (agentId: string) => {
  const result = await query('SELECT email FROM users WHERE id = $1', [agentId]);
  return result.rows?.[0]?.email || null;
};

const buildConfirmedLeadPayload = async (lead: Lead) => {
  const leadWorth = Number(lead.actualPrice ?? lead.latestRevisedPrice ?? lead.initialPrice ?? 0);
  
  // Calculate commission using rule-based service
  const commissionResult = calculateCommission({
    leadWorth,
    employeeId: String(lead.agentId || ''),
    leadId: String(lead.id || '')
  });
  
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
    commission: commissionResult.commission,
    commissionRule: commissionResult.ruleApplied,
    ruleDescription: getRuleDescription(commissionResult.ruleApplied),
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
