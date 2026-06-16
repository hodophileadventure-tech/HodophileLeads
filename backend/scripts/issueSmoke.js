// Simple issue smoke test
const base = process.env.SMOKE_BASE_URL || `http://localhost:${process.env.PORT || 5001}`;
const fs = require('fs');
const path = require('path');

async function run() {
  try {
    console.log('Logging in as admin...');
    let r = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@hodophile.com', password: 'admin@123' })
    });
    const login = await r.json();
    if (!login.token) {
      console.error('Login failed', login);
      return;
    }
    const token = login.token;
    const userId = login.user?.id;
    console.log('Logged in, user id:', userId);

    const headers = { Authorization: `Bearer ${token}` };

    console.log('Creating issue...');
    // Send JSON for initial create (multipart handling may vary across clients)
    r = await fetch(`${base}/api/admin/issues`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'Agent Panel', description: 'Smoke test issue - please ignore', reporterRole: 'admin', reporterId: userId || '' }) });
    const created = await r.json();
    console.log('Create response:', created);
    const issueId = created?.issue?.id || created?.id || created?.issueId;
    console.log('Issue id:', issueId);

    if (!issueId) {
      console.error('Issue creation failed - cannot proceed with attachment upload');
      return;
    }

    // create a tiny PNG file
    const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAAWgmWQ0AAAAASUVORK5CYII=';
    const uploadPath = path.join(__dirname, '..', 'uploads', `smoke-${Date.now()}.png`);
    fs.mkdirSync(path.dirname(uploadPath), { recursive: true });
    fs.writeFileSync(uploadPath, Buffer.from(pngBase64, 'base64'));

    console.log('Uploading attachment...');
    const form2 = new FormData();
    form2.append('attachment', fs.createReadStream(uploadPath));

    r = await fetch(`${base}/api/admin/issues/${issueId}/attachments`, { method: 'POST', body: form2, headers });
    const attachRes = await r.json();
    console.log('Attachment response:', attachRes);

    console.log('Listing issues...');
    r = await fetch(`${base}/api/admin/issues`, { method: 'GET', headers });
    const list = await r.json();
    console.log('Issues count:', Array.isArray(list.issues) ? list.issues.length : Object.keys(list).length);

    console.log('Issue smoke test completed.');
  } catch (err) {
    console.error('Issue smoke failed', err);
    process.exitCode = 1;
  }
}

run();
