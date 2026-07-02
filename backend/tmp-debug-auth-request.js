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
  try {
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
    console.log('LOGIN', loginRes.statusCode, loginRes.body);

    const loginData = JSON.parse(loginRes.body);
    const token = loginData.token;
    if (!token) {
      console.error('No token received');
      return;
    }

    const updateBody = JSON.stringify({ status: 'spam', potential: false });
    const updateOptions = {
      hostname: 'localhost',
      port: 5001,
      path: '/api/leads/31ebdc65-cc3f-4fab-8119-00f0c0041bcd',
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(updateBody),
        'Authorization': `Bearer ${token}`
      }
    };

    const updateRes = await doRequest(updateOptions, updateBody);
    console.log('UPDATE', updateRes.statusCode, updateRes.headers, updateRes.body);
  } catch (err) {
    console.error('ERROR', err);
  }
})();