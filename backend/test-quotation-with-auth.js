const jwt = require('jsonwebtoken');
const http = require('http');

// Generate manager token
const token = jwt.sign(
  { id: 'test-manager', email: 'manager@test.com', role: 'manager' }, 
  'super-secret-key'
);

console.log('Generated Manager Token:', token);
console.log('\n' + '='.repeat(60));
console.log('Testing Quotation Number Endpoint with Manager Role');
console.log('='.repeat(60) + '\n');

async function testWithToken(authToken) {
  const today = new Date().toISOString().split('T')[0];
  
  const options = {
    hostname: 'localhost',
    port: 5001,
    path: `/api/quote-requests/next-number?date=${today}`,
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    }
  };

  return new Promise((resolve) => {
    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', chunk => {
        data += chunk;
      });

      res.on('end', () => {
        console.log(`Status Code: ${res.statusCode}`);
        
        if (res.statusCode === 200) {
          try {
            const parsed = JSON.parse(data);
            console.log(`✓ Quotation Number: ${parsed.quotationNumber}`);
            console.log(`\n✅ SUCCESS! Quotation number is: ${parsed.quotationNumber}`);
            console.log('The endpoint is now working correctly with manager role!');
            resolve(true);
          } catch (e) {
            console.error('Failed to parse response:', e);
            resolve(false);
          }
        } else {
          console.log(`Response: ${data}`);
          console.log(`\n❌ ERROR! Status ${res.statusCode}`);
          resolve(false);
        }
      });
    });

    req.on('error', (error) => {
      console.error('❌ Request error:', error.message);
      resolve(false);
    });

    req.end();
  });
}

// Run test
testWithToken(token).then(success => {
  process.exit(success ? 0 : 1);
});
