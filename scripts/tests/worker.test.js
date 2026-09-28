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
