const http = require('http');

// Test the quotation number endpoint
async function testQuotationNumber() {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  
  console.log(`Testing quotation number endpoint...`);
  console.log(`Date: ${today}\n`);

  const options = {
    hostname: 'localhost',
    port: 5001,
    path: `/api/quote-requests/next-number?date=${today}`,
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
      // Note: No auth token - testing if endpoint returns proper error or works
    }
  };

  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', chunk => {
        data += chunk;
      });

      res.on('end', () => {
        console.log(`Status Code: ${res.statusCode}`);
        console.log(`Response:`, data);
        
        if (res.statusCode === 200) {
          try {
            const parsed = JSON.parse(data);
            console.log(`✓ Quotation Number: ${parsed.quotationNumber}`);
            resolve(parsed.quotationNumber);
          } catch (e) {
            console.error('Failed to parse response:', e);
            resolve(null);
          }
        } else if (res.statusCode === 401) {
          console.log('Status 401: Unauthorized - Auth token required');
          resolve(null);
        } else if (res.statusCode === 403) {
          console.log('Status 403: Forbidden - Insufficient permissions');
          resolve(null);
        } else {
          resolve(null);
        }
      });
    });

    req.on('error', (error) => {
      console.error('Request error:', error.message);
      if (error.code === 'ECONNREFUSED') {
        console.log('\n⚠️  Backend is not running on port 5001');
        console.log('Please start the backend with: npm run dev --prefix backend');
      }
      resolve(null);
    });

    req.end();
  });
}

// Run test
testQuotationNumber().then(result => {
  if (result) {
    console.log(`\n✓ Endpoint is working! Got quotation number: ${result}`);
    process.exit(0);
  } else {
    console.log(`\n⚠️  Unable to get quotation number. Check backend status and auth.`);
    process.exit(1);
  }
});
