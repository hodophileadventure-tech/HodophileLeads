-- create user
INSERT INTO "User" (id, email, password, role, "createdAt", "updatedAt")
VALUES ('u-test-emp-1', 'test-portal-employee-1@example.com', 'password', 'employee', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- insert full employee
INSERT INTO "Employee" (
  id, "userId", "fullName", "cnicNumber", email, "phoneNumber", address, "emergencyContactName", "emergencyContactNumber", "employeeId", designation, department, "joiningDate", "monthlySalary", status, "createdAt", "updatedAt"
)
VALUES (
  'ecdde89f-975f-4f37-9da7-22e803c2ca63', 'u-test-emp-1', 'Test Employee', 'CNIC-0000', 'test-portal-employee-1@example.com', '+10000000000', 'Test Address', 'Emergency', '+10000000001', 'EMP-1', 'Agent', 'Sales', NOW(), 0, 'active', NOW(), NOW()
)
ON CONFLICT (id) DO NOTHING;