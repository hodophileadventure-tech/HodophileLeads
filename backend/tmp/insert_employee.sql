INSERT INTO "Employee" (id, "fullName", email, "createdAt", "updatedAt", status)
VALUES ('ecdde89f-975f-4f37-9da7-22e803c2ca63', 'Test Employee', 'test-portal-employee-1@example.com', NOW(), NOW(), 'active')
ON CONFLICT (id) DO NOTHING;