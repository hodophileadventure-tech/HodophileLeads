-- create user
INSERT INTO "User" (id, email, password, role, "createdAt", "updatedAt")
VALUES ('u-test-emp-1', 'test-portal-employee-1@example.com', 'password', 'employee', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- insert employee referencing userId
INSERT INTO "Employee" (id, "userId", "fullName", email, "createdAt", "updatedAt", status)
VALUES ('ecdde89f-975f-4f37-9da7-22e803c2ca63', 'u-test-emp-1', 'Test Employee', 'test-portal-employee-1@example.com', NOW(), NOW(), 'active')
ON CONFLICT (id) DO NOTHING;