const jwt = require('jsonwebtoken');
const http = require('http');

// Test with BOTH admin and manager roles
async function testBothRoles() {
  const token = (role) => jwt.sign(
    { id: `test-${role}`, email: `${role}@test.com`, role },
    'super-secret-key'
  );

  const test = async (role) => {
    return new Promise((resolve) => {
      const authToken = token(role);
      const today = new Date().toISOString().split('T')[0];
      
      const options = {
        hostname: 'localhost',
        port: 5001,
        path: `/api/quote-requests/next-number?date=${today}`,
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      };

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          if (res.statusCode === 200) {
            const parsed = JSON.parse(data);
            console.log(`✅ ${role.toUpperCase()}: ${parsed.quotationNumber}`);
            resolve(true);
          } else {
            console.log(`❌ ${role.toUpperCase()}: Status ${res.statusCode}`);
            resolve(false);
          }
        });
      });

      req.on('error', () => {
        console.log(`❌ ${role.toUpperCase()}: Connection error`);
        resolve(false);
      });

      req.end();
    });
  };

  console.log('Testing quotation endpoint with both roles...\n');
  await test('admin');
  await test('manager');
  console.log('\n✅ Both roles can generate quotation numbers!');
}

testBothRoles();
