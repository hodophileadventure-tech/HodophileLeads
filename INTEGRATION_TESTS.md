// Integration Test Cases
// Location: backend/tests/integration/commission-integration.test.ts (Lead Manager)
// Or: __tests__/api/external/commission.test.ts (Employee Portal)

import axios from 'axios';

const LEAD_MANAGER_API = 'http://localhost:5000';
const EMPLOYEE_PORTAL_API = 'http://localhost:3000';
const API_KEY = process.env.INTERNAL_API_KEY || 'test-api-key';

describe('Commission Integration Tests', () => {
  let leadId: string;
  let employeeId: string;
  let agentToken: string;
  let adminToken: string;

  beforeAll(async () => {
    // Setup: Create test employee in Employee Portal
    // Setup: Create test agent in Lead Manager
  });

  describe('Commission Calculation Rules', () => {
    it('should calculate 500 commission for lead worth <= 25000', async () => {
      const lead = {
        clientName: 'Test Customer 1',
        phone: '+923001111111',
        destination: 'Dubai',
        persons: 2,
        initialPrice: 20000,
      };

      const response = await axios.post(
        `${LEAD_MANAGER_API}/api/leads`,
        lead,
        { headers: { Authorization: `Bearer ${agentToken}` } }
      );

      leadId = response.data.id;

      // Confirm the lead
      const confirmResponse = await axios.patch(
        `${LEAD_MANAGER_API}/api/leads/${leadId}`,
        { pipelineStage: 'confirmed' },
        { headers: { Authorization: `Bearer ${agentToken}` } }
      );

      expect(confirmResponse.status).toBe(200);

      // Wait for outbox worker to process (max 61 seconds)
      await new Promise((r) => setTimeout(r, 2000));

      // Verify commission in Employee Portal
      const commissionRecords = await axios.get(
        `${EMPLOYEE_PORTAL_API}/api/admin/salary/records`,
        { headers: { Authorization: `Bearer ${adminToken}` } }
      );

      const record = commissionRecords.data.find((r: any) => r.leadId === leadId);
      expect(record).toBeDefined();
      expect(record.commission).toBe(500);
    });

    it('should calculate 1000 commission for lead worth > 25000', async () => {
      const lead = {
        clientName: 'Test Customer 2',
        phone: '+923002222222',
        destination: 'USA',
        persons: 4,
        initialPrice: 50000,
      };

      const response = await axios.post(
        `${LEAD_MANAGER_API}/api/leads`,
        lead,
        { headers: { Authorization: `Bearer ${agentToken}` } }
      );

      leadId = response.data.id;

      // Confirm the lead
      await axios.patch(
        `${LEAD_MANAGER_API}/api/leads/${leadId}`,
        { pipelineStage: 'confirmed' },
        { headers: { Authorization: `Bearer ${agentToken}` } }
      );

      await new Promise((r) => setTimeout(r, 2000));

      // Verify commission
      const commissionRecords = await axios.get(
        `${EMPLOYEE_PORTAL_API}/api/admin/salary/records`,
        { headers: { Authorization: `Bearer ${adminToken}` } }
      );

      const record = commissionRecords.data.find((r: any) => r.leadId === leadId);
      expect(record).toBeDefined();
      expect(record.commission).toBe(1000);
    });
  });

  describe('Idempotency', () => {
    it('should not create duplicate commissions for same lead', async () => {
      const lead = {
        clientName: 'Idempotency Test',
        phone: '+923003333333',
        destination: 'Dubai',
        persons: 2,
        initialPrice: 35000,
      };

      const response = await axios.post(
        `${LEAD_MANAGER_API}/api/leads`,
        lead,
        { headers: { Authorization: `Bearer ${agentToken}` } }
      );

      leadId = response.data.id;

      // Confirm multiple times
      await axios.patch(
        `${LEAD_MANAGER_API}/api/leads/${leadId}`,
        { pipelineStage: 'confirmed' },
        { headers: { Authorization: `Bearer ${agentToken}` } }
      );

      await new Promise((r) => setTimeout(r, 2000));

      // Check first commission record
      let records = await axios.get(
        `${EMPLOYEE_PORTAL_API}/api/admin/salary/records`,
        { headers: { Authorization: `Bearer ${adminToken}` } }
      );

      const firstRecord = records.data.find((r: any) => r.leadId === leadId);
      expect(firstRecord.commission).toBe(1000);

      // Try confirming again (shouldn't create duplicate)
      await axios.patch(
        `${LEAD_MANAGER_API}/api/leads/${leadId}`,
        { pipelineStage: 'confirmed', confirmed: true },
        { headers: { Authorization: `Bearer ${agentToken}` } }
      );

      await new Promise((r) => setTimeout(r, 2000));

      // Verify commission didn't double
      records = await axios.get(
        `${EMPLOYEE_PORTAL_API}/api/admin/salary/records`,
        { headers: { Authorization: `Bearer ${adminToken}` } }
      );

      const secondRecord = records.data.find((r: any) => r.leadId === leadId);
      expect(secondRecord.commission).toBe(1000); // Should still be 1000, not 2000
    });
  });

  describe('API Authentication', () => {
    it('should reject request without API key', async () => {
      try {
        await axios.post(
          `${EMPLOYEE_PORTAL_API}/api/external/commission`,
          {
            leadId: 'test-uuid',
            employeeId: 'emp-id',
            leadWorth: 30000,
            commission: 1000,
            confirmedAt: new Date().toISOString(),
          }
        );
        fail('Should have thrown 401 error');
      } catch (error: any) {
        expect(error.response.status).toBe(401);
        expect(error.response.data.message).toContain('Unauthorized');
      }
    });

    it('should reject request with invalid API key', async () => {
      try {
        await axios.post(
          `${EMPLOYEE_PORTAL_API}/api/external/commission`,
          {
            leadId: 'test-uuid',
            employeeId: 'emp-id',
            leadWorth: 30000,
            commission: 1000,
            confirmedAt: new Date().toISOString(),
          },
          { headers: { Authorization: 'ApiKey invalid-key' } }
        );
        fail('Should have thrown 401 error');
      } catch (error: any) {
        expect(error.response.status).toBe(401);
      }
    });

    it('should accept request with valid API key', async () => {
      const response = await axios.post(
        `${EMPLOYEE_PORTAL_API}/api/external/commission`,
        {
          leadId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
          employeeId: employeeId,
          leadWorth: 30000,
          commission: 1000,
          confirmedAt: new Date().toISOString(),
        },
        { headers: { Authorization: `ApiKey ${API_KEY}` } }
      );

      expect(response.status).toBeOneOf([200, 201]);
      expect(response.data.success).toBe(true);
    });
  });

  describe('Payload Validation', () => {
    it('should reject invalid JSON', async () => {
      try {
        await axios.post(
          `${EMPLOYEE_PORTAL_API}/api/external/commission`,
          'invalid json {',
          { headers: { Authorization: `ApiKey ${API_KEY}` } }
        );
        fail('Should have thrown 400 error');
      } catch (error: any) {
        expect(error.response.status).toBe(400);
        expect(error.response.data.message).toContain('Invalid JSON');
      }
    });

    it('should reject missing required fields', async () => {
      try {
        await axios.post(
          `${EMPLOYEE_PORTAL_API}/api/external/commission`,
          {
            leadId: 'uuid',
            // Missing employeeId, leadWorth, commission, confirmedAt
          },
          { headers: { Authorization: `ApiKey ${API_KEY}` } }
        );
        fail('Should have thrown 400 error');
      } catch (error: any) {
        expect(error.response.status).toBe(400);
        expect(error.response.data.errors).toBeDefined();
        expect(error.response.data.errors.length).toBeGreaterThan(0);
      }
    });

    it('should reject invalid data types', async () => {
      try {
        await axios.post(
          `${EMPLOYEE_PORTAL_API}/api/external/commission`,
          {
            leadId: 'uuid',
            employeeId: 'emp-id',
            leadWorth: 'not-a-number', // Should be number
            commission: 1000,
            confirmedAt: new Date().toISOString(),
          },
          { headers: { Authorization: `ApiKey ${API_KEY}` } }
        );
        fail('Should have thrown 400 error');
      } catch (error: any) {
        expect(error.response.status).toBe(400);
      }
    });

    it('should reject invalid UUID format', async () => {
      try {
        await axios.post(
          `${EMPLOYEE_PORTAL_API}/api/external/commission`,
          {
            leadId: 'not-a-uuid', // Invalid format
            employeeId: 'emp-id',
            leadWorth: 30000,
            commission: 1000,
            confirmedAt: new Date().toISOString(),
          },
          { headers: { Authorization: `ApiKey ${API_KEY}` } }
        );
        fail('Should have thrown 400 error');
      } catch (error: any) {
        expect(error.response.status).toBe(400);
        expect(error.response.data.errors).toBeDefined();
      }
    });
  });

  describe('Employee Verification', () => {
    it('should reject commission for non-existent employee', async () => {
      try {
        await axios.post(
          `${EMPLOYEE_PORTAL_API}/api/external/commission`,
          {
            leadId: 'f47ac10b-58cc-4372-a567-0e02b2c3d47a',
            employeeId: 'non-existent-id',
            leadWorth: 30000,
            commission: 1000,
            confirmedAt: new Date().toISOString(),
          },
          { headers: { Authorization: `ApiKey ${API_KEY}` } }
        );
        fail('Should have thrown 404 error');
      } catch (error: any) {
        expect(error.response.status).toBe(404);
        expect(error.response.data.message).toContain('Employee not found');
      }
    });
  });

  describe('Monthly Incentive', () => {
    it('should apply 30k incentive when total sales >= 1 crore', async () => {
      // This is a complex scenario that requires:
      // 1. Creating multiple leads totaling >= 1 crore
      // 2. Confirming all leads in same month
      // 3. Calculating payroll
      // 4. Verifying incentive is applied

      // Example: Create 10 leads of 1 million each
      const leadPromises = Array.from({ length: 10 }, (_, i) =>
        axios.post(
          `${LEAD_MANAGER_API}/api/leads`,
          {
            clientName: `Incentive Test ${i}`,
            phone: `+9230${String(i).padStart(9, '0')}`,
            destination: 'Dubai',
            persons: 5,
            initialPrice: 1000000,
          },
          { headers: { Authorization: `Bearer ${agentToken}` } }
        )
      );

      const leadResponses = await Promise.all(leadPromises);
      const leadIds = leadResponses.map((r) => r.data.id);

      // Confirm all leads
      const confirmPromises = leadIds.map((id) =>
        axios.patch(
          `${LEAD_MANAGER_API}/api/leads/${id}`,
          { pipelineStage: 'confirmed' },
          { headers: { Authorization: `Bearer ${agentToken}` } }
        )
      );

      await Promise.all(confirmPromises);
      await new Promise((r) => setTimeout(r, 3000));

      // Calculate salary for this month
      const [year, month] = new Date().toISOString().split('-');
      await axios.post(
        `${EMPLOYEE_PORTAL_API}/api/admin/salary/calculate`,
        {
          employeeId: employeeId,
          month: `${year}-${month}`,
        },
        { headers: { Authorization: `Bearer ${adminToken}` } }
      );

      // Get salary record
      const records = await axios.get(
        `${EMPLOYEE_PORTAL_API}/api/admin/salary/records`,
        { headers: { Authorization: `Bearer ${adminToken}` } }
      );

      const salaryRecord = records.data.find((r: any) => r.employeeId === employeeId);

      // Verify incentive (should be 30000)
      expect(salaryRecord.monthlyIncentive).toBe(30000);
      expect(salaryRecord.commission).toBeGreaterThanOrEqual(10000); // 10 leads × 1000
    });

    it('should NOT apply incentive when total sales < 1 crore', async () => {
      // Create leads totaling less than 1 crore
      const lead = await axios.post(
        `${LEAD_MANAGER_API}/api/leads`,
        {
          clientName: 'No Incentive Test',
          phone: '+923004444444',
          destination: 'Dubai',
          persons: 2,
          initialPrice: 50000,
        },
        { headers: { Authorization: `Bearer ${agentToken}` } }
      );

      await axios.patch(
        `${LEAD_MANAGER_API}/api/leads/${lead.data.id}`,
        { pipelineStage: 'confirmed' },
        { headers: { Authorization: `Bearer ${agentToken}` } }
      );

      await new Promise((r) => setTimeout(r, 2000));

      // Calculate salary
      const [year, month] = new Date().toISOString().split('-');
      await axios.post(
        `${EMPLOYEE_PORTAL_API}/api/admin/salary/calculate`,
        {
          employeeId: employeeId,
          month: `${year}-${month}`,
        },
        { headers: { Authorization: `Bearer ${adminToken}` } }
      );

      // Get salary record
      const records = await axios.get(
        `${EMPLOYEE_PORTAL_API}/api/admin/salary/records`,
        { headers: { Authorization: `Bearer ${adminToken}` } }
      );

      const salaryRecord = records.data.find((r: any) => r.employeeId === employeeId);

      // Verify NO incentive (should be 0)
      expect(salaryRecord.monthlyIncentive).toBe(0);
    });
  });

  describe('Outbox Worker Retry Logic', () => {
    it('should retry failed deliveries with exponential backoff', async () => {
      // Temporarily disable Employee Portal endpoint
      // Trigger a lead confirmation in Lead Manager
      // Verify outbox event is marked as pending with retry_count incremented

      // Re-enable Employee Portal endpoint
      // Verify outbox worker retries and eventually succeeds

      // This test requires modifying the API or using mocks
      // Recommended: Use sinon/jest mocks for HTTP calls
    });

    it('should mark event as permanently failed after MAX_RETRY attempts', async () => {
      // Similar to above but verify event is marked as 'failed' after 5 retries
    });
  });
});
