const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { spawn } = require('child_process');
const { ROOT, PAGE_COPIES, read } = require('./helpers');

// Boots scripts/serve.js on an ephemeral port and resolves its base URL.
function startServer() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(ROOT, 'scripts', 'serve.js')], { env: { ...process.env, PORT: '0' } });
    child.stdout.on('data', (buf) => {
      const m = String(buf).match(/http:\/\/127\.0\.0\.1:(\d+)/);
      if (m) resolve({ child, base: 'http://127.0.0.1:' + m[1] });
    });
    child.on('error', reject);
    child.on('exit', (code) => reject(new Error('serve.js exited ' + code)));
  });
}

test('WI-3: /terms.html returns 200 from scripts/serve.js; traversal and / behave', async () => {
  const { child, base } = await startServer();
  try {
    const res = await fetch(base + '/terms.html');
    assert.strictEqual(res.status, 200);
    assert.match(await res.text(), /Terms &amp; Refund Policy/);
    assert.strictEqual((await fetch(base + '/')).status, 200);
    // Raw request path (fetch would normalise the '..'): must not escape public/.
    const rawStatus = await new Promise((resolve, reject) => {
      require('http').get(base + '/', { path: '/../index.html' }, (r) => { r.resume(); resolve(r.statusCode); }).on('error', reject);
    });
    assert.strictEqual(rawStatus, 404);
    assert.strictEqual((await fetch(base + '/missing.html')).status, 404);
  } finally {
    child.kill();
  }
});

test('WI-3: terms page content, disclaimers and counsel flag', () => {
  const html = read('public/terms.html');
  assert.ok(html.includes('<!-- COUNSEL REVIEW REQUIRED BEFORE RELYING ON THIS PAGE -->'));
  assert.match(html, /<p class="last-updated">Last updated: [A-Z][a-z]+ \d{1,2}, \d{4}<\/p>/);
  for (const needle of [
    'APEX Business Systems Ltd., Edmonton, AB',
    'support@life-path.icu',
    'emailed within 24 hours',
    'full refund within 14 days',
    'Numerology is offered here for reflection and entertainment.',
    'never touch our servers',
    'Province of Alberta'
  ]) assert.ok(html.includes(needle), needle);
  // Tier wording must match the tier cards on the landing page.
  const page = read('public/index.html');
  for (const desc of [
    'Your complete numerical score profile with verified archetype classification.',
    'Multi-page deep analysis detailing how your Life Path and Expression Numbers interact.',
    'The exhaustive numerical ledger profile covering lifecycle cycles and personal timing.'
  ]) {
    assert.ok(page.includes(desc) && html.includes(desc), desc);
  }
});

test('WI-3: terms page makes no external requests (only relative src/href assets)', () => {
  const html = read('public/terms.html');
  const loads = html.match(/<(script|img|iframe)[^>]+src="[^"]*"|<link[^>]+rel="(stylesheet|preload|icon)"[^>]*>/g) || [];
  for (const tag of loads) assert.ok(!/(src|href)="(https?:)?\/\//.test(tag), tag);
});

test('WI-3: footer links to /terms.html next to Privacy in every page copy', () => {
  for (const copy of PAGE_COPIES) {
    assert.ok(read(copy).includes('<a href="/privacy.html">Privacy Policy</a>\n    <a href="/terms.html">Terms &amp; Refunds</a>'), copy);
  }
});
