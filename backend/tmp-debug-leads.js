const http = require('http');

function doRequest(options, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({ statusCode: res.statusCode, headers: res.headers, body: data });
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

(async () => {
  const loginBody = JSON.stringify({ email: 'admin@hodophile.com', password: 'admin@123' });
  const loginOptions = {
    hostname: 'localhost',
    port: 5001,
    path: '/api/auth/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(loginBody)
    }
  };

  const loginRes = await doRequest(loginOptions, loginBody);
  const loginData = JSON.parse(loginRes.body);
  const token = loginData.token;
  console.log('token', token);

  const leadsOptions = {
    hostname: 'localhost',
    port: 5001,
    path: '/api/leads',
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`
    }
  };

  const leadsRes = await doRequest(leadsOptions);
  const leads = JSON.parse(leadsRes.body);
  console.log('lead count', leads.length);
  for (const lead of leads) {
    console.log('lead', lead.id, lead.clientName || lead.name, lead.status);
  }
})();