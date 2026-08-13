/**
 * Simple diagnostic test
 */

const jwt = require('jsonwebtoken');
const http = require('http');

const JWT_SECRET = 'super-secret-key';

const adminToken = jwt.sign(
  { 
    id: '550e8400-e29b-41d4-a716-446655440001',
    email: 'admin@test.com',
    role: 'admin',
    name: 'Admin User'
  },
  JWT_SECRET
);

console.log('Testing basic connectivity...\n');
console.log(`Admin Token: ${adminToken.substring(0, 50)}...\n`);

// Test 1: Health check (no auth needed)
const options1 = {
  hostname: 'localhost',
  port: 5000,
  path: '/',
  method: 'GET',
  headers: {}
};

const req1 = http.request(options1, (res) => {
  let data = '';
  res.on('data', chunk => { data += chunk; });
  res.on('end', () => {
    console.log(`✅ Health check: ${res.statusCode}`);
    console.log(`   Headers: Content-Type=${res.headers['content-type']}\n`);
  });
});

req1.on('error', (err) => {
  console.log(`❌ Health check failed: ${err.message}`);
});

req1.end();

// Wait a moment then test auth
setTimeout(() => {
  // Test 2: Auth header parsing
  const options2 = {
    hostname: 'localhost',
    port: 5000,
    path: '/api/leads',
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${adminToken}`
    }
  };

  const req2 = http.request(options2, (res) => {
    let data = '';
    res.on('data', chunk => { data += chunk; });
    res.on('end', () => {
      console.log(`✅ Auth test (GET /api/leads): ${res.statusCode}`);
      if (res.statusCode !== 200) {
        console.log(`   Response: ${data.substring(0, 150)}`);
      } else {
        console.log(`   ✓ Auth working!`);
      }
    });
  });

  req2.on('error', (err) => {
    console.log(`❌ Auth test failed: ${err.message}`);
  });

  req2.end();

  // Test 3: POST with body
  setTimeout(() => {
    const taskBody = JSON.stringify({
      assignedTo: '550e8400-e29b-41d4-a716-446655440002',
      title: 'Test Task',
      description: 'Testing task creation',
      deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      priority: 'high'
    });

    const options3 = {
      hostname: 'localhost',
      port: 5000,
      path: '/api/tasks',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(taskBody)
      }
    };

    const req3 = http.request(options3, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        console.log(`\n✅ Task creation attempt: ${res.statusCode}`);
        console.log(`   Response: ${data.substring(0, 200)}`);
      });
    });

    req3.on('error', (err) => {
      console.log(`❌ Task creation failed: ${err.message}`);
    });

    req3.write(taskBody);
    req3.end();
  }, 500);
}, 500);
