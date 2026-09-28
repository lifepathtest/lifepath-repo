const test = require('node:test');
const assert = require('node:assert');
const { loadWorker } = require('./helpers');

function assetsStub() {
  const calls = [];
  return { calls, fetch: async (req) => { calls.push(req.url); return new Response('asset', { status: 200 }); } };
}

test('WI-1: www host 301-redirects to apex, preserving path and query', async () => {
  const worker = await loadWorker();
  const ASSETS = assetsStub();
  const res = await worker.fetch(new Request('https://www.life-path.icu/x?y=1'), { ASSETS }, {});
  assert.strictEqual(res.status, 301);
  assert.strictEqual(res.headers.get('location'), 'https://life-path.icu/x?y=1');
  assert.strictEqual(ASSETS.calls.length, 0);
});

test('WI-1: apex host passes through to ASSETS', async () => {
  const worker = await loadWorker();
  const ASSETS = assetsStub();
  const res = await worker.fetch(new Request('https://life-path.icu/x?y=1'), { ASSETS }, {});
  assert.strictEqual(res.status, 200);
  assert.strictEqual(await res.text(), 'asset');
  assert.deepStrictEqual(ASSETS.calls, ['https://life-path.icu/x?y=1']);
});

const CHROME_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

// POSTs to /track with a stubbed Supabase fetch; returns the response and every row the Worker tried to write.
async function postTrack(body, { ua = CHROME_UA, cf } = {}) {
  const worker = await loadWorker();
  const writes = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    writes.push({ url, row: JSON.parse(init.body) });
    return new Response(null, { status: 201 });
  };
  try {
    const request = new Request('https://life-path.icu/track', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'user-agent': ua },
      body: typeof body === 'string' ? body : JSON.stringify(body)
    });
    if (cf) Object.defineProperty(request, 'cf', { value: cf });
    const env = { SUPABASE_SERVICE_ROLE_KEY: 'test-key', SUPABASE_URL: 'https://example.supabase.co', ASSETS: assetsStub() };
    const res = await worker.fetch(request, env, {});
    return { res, writes };
  } finally {
    globalThis.fetch = realFetch;
  }
}

test('WI-4: stored row has no IP / user-agent, carries country + human ua_class', async () => {
  const { res, writes } = await postTrack({ event_name: 'free_result_shown', meta: { sid: 'a1b2c3d4e5f60718', lifePath: 7, hasName: true } }, { cf: { country: 'CA' } });
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.headers.get('cache-control'), 'no-store');
  assert.strictEqual(writes.length, 1);
  assert.strictEqual(writes[0].url, 'https://example.supabase.co/rest/v1/lifepath_events');
  const row = writes[0].row;
  assert.strictEqual(row.ip, null);
  assert.strictEqual(row.user_agent, null);
  assert.deepStrictEqual(row.meta, { sid: 'a1b2c3d4e5f60718', lifePath: 7, hasName: true, country: 'CA', ua_class: 'human' });
});

test('WI-4: curl and empty user-agents are classed as bot; missing cf country is null', async () => {
  for (const ua of ['curl/8.5.0', '']) {
    const { writes } = await postTrack({ event_name: 'quiz_viewed', meta: {} }, { ua });
    assert.strictEqual(writes[0].row.meta.ua_class, 'bot', JSON.stringify(ua));
    assert.strictEqual(writes[0].row.meta.country, null);
  }
});

test('WI-4: unknown, missing or malformed events return 204 without a write', async () => {
  for (const body of [{ event_name: 'purchase_completed' }, { meta: {} }, 'not json', 'null']) {
    const { res, writes } = await postTrack(body);
    assert.strictEqual(res.status, 204, JSON.stringify(body));
    assert.strictEqual(res.headers.get('access-control-allow-origin'), '*');
    assert.strictEqual(res.headers.get('cache-control'), 'no-store');
    assert.strictEqual(writes.length, 0);
  }
});

test('WI-4: bodies over 4 KB are rejected with 413 and not written', async () => {
  const { res, writes } = await postTrack({ event_name: 'quiz_viewed', meta: { pad: 'x'.repeat(5 * 1024) } });
  assert.strictEqual(res.status, 413);
  assert.strictEqual(writes.length, 0);
});

test('WI-4: meta is allowlisted, PII keys stripped, strings capped at 64, client ua_class/country ignored', async () => {
  const { writes } = await postTrack({
    event_name: 'checkout_redirect',
    meta: { tier: 'deep', ref: 'r'.repeat(100), birthDate: '1990-05-12', fullName: 'Ada Lovelace', email: 'a@b.c', ua_class: 'human', country: 'XX', sid: { nested: true } }
  }, { ua: 'python-requests/2.31', cf: { country: 'US' } });
  const meta = writes[0].row.meta;
  assert.deepStrictEqual(Object.keys(meta).sort(), ['country', 'ref', 'tier', 'ua_class']);
  assert.strictEqual(meta.ref.length, 64);
  assert.strictEqual(meta.ua_class, 'bot');
  assert.strictEqual(meta.country, 'US');
  assert.strictEqual(meta.birthDate, undefined);
});

test('WI-4: CORS preflight and non-POST behaviour are unchanged', async () => {
  const worker = await loadWorker();
  const env = { ASSETS: assetsStub() };
  const pre = await worker.fetch(new Request('https://life-path.icu/track', { method: 'OPTIONS' }), env, {});
  assert.strictEqual(pre.status, 204);
  assert.strictEqual(pre.headers.get('access-control-allow-methods'), 'POST, OPTIONS');
  const get = await worker.fetch(new Request('https://life-path.icu/api/track'), env, {});
  assert.strictEqual(get.status, 405);
});
