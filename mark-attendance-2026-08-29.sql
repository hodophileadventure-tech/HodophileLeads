BEGIN;

-- Insert the attendance sheet lock for 2026-08-29
INSERT INTO attendance_sheets (attendance_date, locked_by)
VALUES ('2026-08-29'::date, (SELECT id FROM users WHERE role = 'admin' LIMIT 1))
ON CONFLICT (attendance_date) DO NOTHING;

-- Insert present attendance for all eligible employees
WITH eligible AS (
  SELECT u.id, u.name, u.email
  FROM users u
  LEFT JOIN roles r ON r.id = u.role_id
  WHERE COALESCE(r.slug, u.role, '') <> 'admin' 
    AND u.attendance_exempt = FALSE
)
INSERT INTO attendance (user_id, attendance_date, status, note, marked_by, created_at, updated_at)
SELECT 
  e.id,
  '2026-08-29'::date,
  'present',
  'Marked present on 2026-08-29',
  (SELECT id FROM users WHERE role = 'admin' LIMIT 1),
  NOW(),
  NOW()
FROM eligible e
ON CONFLICT (user_id, attendance_date) 
DO UPDATE SET status = 'present', note = 'Marked present on 2026-08-29', updated_at = NOW();

COMMIT;

-- Verify the result
SELECT 
  '2026-08-29' as attendance_date,
  COUNT(*)::int as total_marked_present,
  'Attendance sheet is now LOCKED' as status
FROM attendance 
WHERE attendance_date = '2026-08-29'::date AND status = 'present';
