require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function reassignLeads() {
  const client = await pool.connect();
  try {
    console.log('🔄 Starting lead reassignment...\n');
    
    // Get first available agent (or create one)
    let agentResult = await client.query(
      `SELECT id, email FROM users WHERE role = 'agent' LIMIT 1`
    );
    
    let agentId;
    let agentEmail;
    
    if (agentResult.rows.length > 0) {
      agentId = agentResult.rows[0].id;
      agentEmail = agentResult.rows[0].email;
      console.log(`✅ Found agent: ${agentEmail} (ID: ${agentId})`);
    } else {
      // Create default agent if none exists
      const bcryptjs = require('bcryptjs');
      const hashedPassword = await bcryptjs.hash('agent@123', 10);
      
      const createResult = await client.query(
        `INSERT INTO users (email, name, password, role) 
         VALUES ($1, $2, $3, $4)
         RETURNING id, email`,
        ['agent@hodophile.pk', 'Sameer', hashedPassword, 'agent']
      );
      
      agentId = createResult.rows[0].id;
      agentEmail = createResult.rows[0].email;
      console.log(`✅ Created new agent: ${agentEmail} (ID: ${agentId})`);
    }
    
    // Check how many leads don't have proper agent_id
    const invalidLeadsResult = await client.query(
      `SELECT COUNT(*) as count FROM leads WHERE agent_id IS NULL OR agent_id NOT IN (SELECT id FROM users)`
    );
    const invalidCount = invalidLeadsResult.rows[0].count;
    
    console.log(`\n📊 Found ${invalidCount} leads with missing/invalid agent_id\n`);
    
    // Reassign all invalid leads to the agent
    if (invalidCount > 0) {
      const updateResult = await client.query(
        `UPDATE leads 
         SET agent_id = $1 
         WHERE agent_id IS NULL OR agent_id NOT IN (SELECT id FROM users)
         RETURNING id`,
        [agentId]
      );
      
      console.log(`✅ Reassigned ${updateResult.rows.length} leads to ${agentEmail}`);
    }
    
    // Show total leads per agent
    console.log('\n📈 Current lead assignment:');
    const statsResult = await client.query(
      `SELECT u.email, COUNT(l.id) as lead_count
       FROM users u
       LEFT JOIN leads l ON l.agent_id = u.id
       WHERE u.role = 'agent'
       GROUP BY u.id, u.email
       ORDER BY lead_count DESC`
    );
    
    for (const row of statsResult.rows) {
      console.log(`   ${row.email}: ${row.lead_count} leads`);
    }
    
    console.log('\n✅ Lead reassignment complete!');
    console.log(`\n🔐 Agent Credentials:`);
    console.log(`   Email: ${agentEmail}`);
    console.log(`   Password: agent@123\n`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Reassignment failed:', error.message);
    process.exit(1);
  } finally {
    client.release();
    pool.end();
  }
}

reassignLeads();
