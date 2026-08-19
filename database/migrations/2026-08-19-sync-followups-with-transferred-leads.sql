WITH latest_transfers AS (
  SELECT DISTINCT ON (al.entity_id)
    al.entity_id AS lead_id,
    al.changes->>'toAgentId' AS target_agent_id
  FROM audit_logs al
  WHERE al.entity_type = 'lead'
    AND al.action = 'LEAD_TRANSFERRED'
    AND al.changes->>'toAgentId' IS NOT NULL
  ORDER BY al.entity_id, al.created_at DESC
)
UPDATE follow_ups fu
SET assigned_to = lt.target_agent_id::uuid
FROM latest_transfers lt
JOIN leads l ON l.id = lt.lead_id
WHERE fu.lead_id = lt.lead_id
  AND l.agent_id = lt.target_agent_id::uuid
  AND fu.assigned_to IS DISTINCT FROM lt.target_agent_id::uuid;
