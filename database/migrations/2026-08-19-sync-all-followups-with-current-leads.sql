UPDATE follow_ups fu
SET assigned_to = l.agent_id
FROM leads l
WHERE fu.lead_id = l.id
  AND l.agent_id IS NOT NULL
  AND fu.assigned_to IS DISTINCT FROM l.agent_id;
