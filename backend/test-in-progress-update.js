#!/usr/bin/env node

/**
 * Test script to debug the 'in_progress' status update issue
 * This script directly tests the lead update flow with different statuses
 */

// Mock the database module
const mockDb = {
  leads: [
    {
      id: 'test-lead-1',
      clientName: 'Test Client',
      status: 'new',
      potential: false,
      email: 'test@example.com',
      phone: '1234567890',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      agent_id: 'agent-1'
    }
  ],
  users: [
    {
      id: 'agent-1',
      email: 'agent@example.com',
      name: 'Test Agent',
      role: 'agent'
    }
  ]
};

// Simulate the query function's lead update handler
function simulateLeadUpdate(text, params) {
  const id = params?.[params.length - 1];
  const index = mockDb.leads.findIndex((lead) => lead.id === id);
  
  console.log('\n=== LEAD UPDATE TEST ===');
  console.log('SQL:', text);
  console.log('Params:', params);
  console.log('Lead ID to update:', id);
  console.log('Lead found:', index >= 0);
  
  if (index < 0) {
    console.log('ERROR: Lead not found');
    return { rows: [], rowCount: 0 };
  }

  const oldStatus = mockDb.leads[index].status;
  const oldPotential = mockDb.leads[index].potential;
  
  const setStart = text.toLowerCase().indexOf('set') + 3;
  const setEnd = text.toLowerCase().lastIndexOf(', updated_at = now()');
  const setClause = text.slice(setStart, setEnd).trim();
  const assignments = setClause.split(',').map((item) => item.trim());

  console.log('\nExtracted:');
  console.log('- setClause:', setClause);
  console.log('- assignments:', assignments);

  const updatedLead = { ...mockDb.leads[index] };
  let updateCount = 0;
  
  for (const assignment of assignments) {
    const match = assignment.match(/^([a-zA-Z0-9_]+)\s*=\s*\$(\d+)$/);
    if (!match) {
      console.log(`- FAILED TO PARSE: "${assignment}"`);
      continue;
    }

    const dbKey = match[1];
    const paramIndex = Number(match[2]) - 1;
    const rawValue = params?.[paramIndex];
    const value = rawValue; // Simplified for testing

    console.log(`- Parsed assignment: ${dbKey} = params[${paramIndex}] = ${JSON.stringify(rawValue)}`);
    updatedLead[dbKey] = value;
    updateCount++;
  }

  const now = new Date().toISOString();
  updatedLead.updated_at = now;

  mockDb.leads[index] = updatedLead;
  
  console.log('\nUpdate result:');
  console.log('- Fields updated:', updateCount);
  console.log('- Old status:', oldStatus, '-> New status:', updatedLead.status);
  console.log('- Old potential:', oldPotential, '-> New potential:', updatedLead.potential);
  console.log('- Final lead:', { id: updatedLead.id, status: updatedLead.status, potential: updatedLead.potential });
  
  return { rows: [updatedLead], rowCount: 1 };
}

// Test cases
console.log('\n\n##############################################');
console.log('TEST 1: Update to "new" status (should work)');
console.log('##############################################');
simulateLeadUpdate(
  'UPDATE leads SET potential = $1, status = $2, updated_at = NOW() WHERE id = $3 RETURNING *',
  [false, 'new', 'test-lead-1']
);

console.log('\n\n##############################################');
console.log('TEST 2: Update to "contacted" status (in_progress)');
console.log('##############################################');
mockDb.leads[0].status = 'new'; // Reset to new
mockDb.leads[0].potential = false;
simulateLeadUpdate(
  'UPDATE leads SET potential = $1, status = $2, updated_at = NOW() WHERE id = $3 RETURNING *',
  [false, 'contacted', 'test-lead-1']
);

console.log('\n\n##############################################');
console.log('TEST 3: Update to "completed" status (dead)');
console.log('##############################################');
mockDb.leads[0].status = 'new'; // Reset to new
mockDb.leads[0].potential = false;
simulateLeadUpdate(
  'UPDATE leads SET potential = $1, status = $2, updated_at = NOW() WHERE id = $3 RETURNING *',
  [false, 'completed', 'test-lead-1']
);

console.log('\n\n##############################################');
console.log('SUMMARY');
console.log('##############################################');
console.log('If all three tests show correct status updates,');
console.log('then the mock database handler is working fine.');
console.log('The issue must be elsewhere.');
