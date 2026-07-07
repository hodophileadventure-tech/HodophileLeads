const worker = require('../dist/workers/outboxWorker');
const axios = require('axios');
const origPost = axios.post;
axios.post = async function(url, data, opts) {
  console.log('[debug] axios.post ->', url, 'data:', JSON.stringify(data), 'opts.headers:', opts && opts.headers);
  try {
    const res = await origPost(url, data, opts);
    console.log('[debug] axios response status', res.status);
    return res;
  } catch (err) {
    console.error('[debug] axios error message', err && err.message);
    if (err.response) {
      console.error('[debug] axios error response status', err.response.status);
      try { console.error('[debug] axios error response data', JSON.stringify(err.response.data)); } catch(e) { console.error(err.response.data); }
    }
    throw err;
  }
}

(async () => {
  try {
    await worker.processOutboxEvents();
    console.log('worker finished');
  } catch (e) {
    console.error('worker crashed', e);
    process.exit(1);
  }
})();
