const http = require('http');

const data = JSON.stringify({ status: 'spam', potential: false });
const options = {
  hostname: 'localhost',
  port: 5001,
  path: '/api/leads/31ebdc65-cc3f-4fab-8119-00f0c0041bcd',
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data),
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImVjZGRlODlmLTk3NWYtNGYzNy05ZGE3LTIyZTgwM2MyY2M2MyIsImVtYWlsIjoiYWRtaW5AaG9kb3BoaWxlLmNvbSIsInJvbGUiOiJhZG1pbiIsImlhdCI6MTc4MjcyMTcwMSwiZXhwIjoxNzgzMzI2NTAxfQ.aE8NQByXZ6qM9e-0l5RN8hbU0E7-CwFQcvtK4q42e1U'
  }
};

const req = http.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => { body += chunk; });
  res.on('end', () => {
    console.log('statusCode', res.statusCode);
    console.log('headers', res.headers);
    console.log('body', body);
  });
});

req.on('error', (err) => { console.error('request error', err); });
req.write(data);
req.end();
