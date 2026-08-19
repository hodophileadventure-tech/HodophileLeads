UPDATE follow_ups f
SET completion_notes = NULLIF(TRIM(l.agent_remarks), '')
FROM leads l
WHERE f.lead_id = l.id
  AND f.status = 'completed'
  AND f.id = (
    SELECT latest.id
    FROM follow_ups latest
    WHERE latest.lead_id = l.id
      AND latest.status = 'completed'
    ORDER BY latest.completed_at DESC NULLS LAST, latest.created_at DESC
    LIMIT 1
  )
  AND NULLIF(TRIM(f.completion_notes), '') IS NULL
  AND NULLIF(TRIM(l.agent_remarks), '') IS NOT NULL;
