// Simple smoke test using node fetch (Node 18+)
const base = process.env.SMOKE_BASE_URL || `http://localhost:${process.env.PORT || 5001}`;

async function run() {
  try {
    console.log('Checking health...');
    let r = await fetch(`${base}/health`);
    console.log('health', await r.json());

    console.log('Logging in...');
    r = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@hodophile.com', password: 'admin@123' })
    });
    const login = await r.json();
    const token = login.token;
    console.log('token length:', token ? token.length : 'none');

    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

    console.log('Creating lead...');
    r = await fetch(`${base}/api/leads`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ clientName: 'Smoke Test Node', email: 'smoke-node@example.com', phone: '+923001112233', destination: 'Skardu', travelDates: { from: '2026-10-01', to: '2026-10-05' }, persons: 2, budget: 250000, source: 'web', specialRequests: 'None' })
    });
    const lead = await r.json();
    console.log('lead id:', lead.id);

    console.log('Transitioning stage...');
    r = await fetch(`${base}/api/leads/${lead.id}/stage`, { method: 'PATCH', headers, body: JSON.stringify({ stage: 'quoted' }) });
    console.log('stage response:', await r.json());

    console.log('Fetching health...');
    r = await fetch(`${base}/api/leads/${lead.id}/health`, { headers });
    console.log('health:', await r.json());

    console.log('Fetching follow-ups...');
    r = await fetch(`${base}/api/follow-ups?leadId=${lead.id}`, { headers });
    const tasks = await r.json();
    console.log('follow-ups count:', Array.isArray(tasks) ? tasks.length : Object.keys(tasks).length);

    console.log('Adding payment...');
    r = await fetch(`${base}/api/payments`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        leadId: lead.id,
        amount: 50000,
        method: 'cash',
        dueDate: new Date(Date.now() + 86400000).toISOString(),
        notes: 'Smoke test deposit'
      })
    });
    const payment = await r.json();
    console.log('payment id:', payment.id);

    console.log('Updating hotel info inline...');
    r = await fetch(`${base}/api/leads/${lead.id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ hotelInfo: { hotelName: 'Smoke Hotel', roomType: 'Suite', roomPrice: 30000 } })
    });
    console.log('lead update response:', await r.json());

    console.log('Smoke test completed.');
  } catch (err) {
    console.error('Smoke test failed:', err);
    process.exitCode = 1;
  }
}

run();
