const test = require('node:test');
const assert = require('node:assert');
const { PAGE_COPIES, read } = require('./helpers');

test('mirror: all 4 page copies are byte-identical', () => {
  const source = read(PAGE_COPIES[0]);
  for (const copy of PAGE_COPIES.slice(1)) {
    assert.strictEqual(read(copy), source, copy + ' differs from ' + PAGE_COPIES[0]);
  }
});

test('WI-1: canonical-host guard appears exactly once, as the first <script> in <head>', () => {
  for (const copy of PAGE_COPIES) {
    const html = read(copy);
    assert.strictEqual(html.split('id="canonical-host-guard"').length - 1, 1, copy);
    const head = html.slice(0, html.indexOf('</head>'));
    assert.ok(head.indexOf('<script') === head.indexOf('<script id="canonical-host-guard">'), copy);
    assert.ok(head.includes('h==="www.life-path.icu"||h==="lifepath-repo.pages.dev"'), copy);
  }
});

// Visible text + JSON-LD of every public page (CSS/JS and markup stripped so class names don't count).
function claimText(html) {
  const ld = (html.match(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g) || []).join(' ');
  const visible = html
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<[^>]+>/g, ' ');
  return visible + ' ' + ld;
}

test('WI-2: no fabricated social proof or unbacked guarantees on any public page', () => {
  const fs = require('fs');
  const path = require('path');
  const { ROOT } = require('./helpers');
  const pages = fs.readdirSync(path.join(ROOT, 'public')).filter((f) => f.endsWith('.html'));
  for (const page of pages) {
    const hits = claimText(read('public/' + page)).match(/thousands|guarantee|join [0-9a-z]+ (people|users)/gi);
    assert.strictEqual(hits, null, 'public/' + page + ': ' + (hits || []).join(', '));
  }
});

test('WI-2: trust bar states delivery + refund terms and links to /terms.html', () => {
  const html = read('public/index.html');
  assert.ok(html.includes('Hand-prepared and emailed within 24 hours · Not happy? Full refund within 14 days — see <a href="/terms.html">Terms</a>'));
  assert.ok(html.includes('<p class="tiers-social-proof">Introductory pricing</p>'));
  assert.ok(!html.includes('Hand-prepared fulfillment'));
  assert.ok(html.includes('<li>Delivered to your checkout email</li>'));
});

const { loadPageScript } = require('./helpers');
const { webcrypto } = require('crypto');

function memoryStorage() {
  const map = new Map();
  return { map, getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)) };
}

test('WI-4: sid is a stable 16-hex per-tab id kept in sessionStorage', () => {
  const sessionStorage = memoryStorage();
  const page = loadPageScript('public/index.html', { crypto: webcrypto, sessionStorage });
  const sid = page.getSid();
  assert.match(sid, /^[0-9a-f]{16}$/);
  assert.strictEqual(page.getSid(), sid);
  assert.strictEqual(sessionStorage.map.get('lp_sid'), sid);
});

test('WI-4: sid still generated when sessionStorage and crypto are unavailable', () => {
  const blocked = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  assert.match(loadPageScript('public/index.html', { sessionStorage: blocked }).getSid(), /^[0-9a-f]{16}$/);
  assert.match(loadPageScript('public/index.html', {}).getSid(), /^[0-9a-f]{16}$/);
});

test('WI-4: track() beacons event_name + meta with sid attached', async () => {
  const sent = [];
  const page = loadPageScript('public/index.html', {
    crypto: webcrypto,
    sessionStorage: memoryStorage(),
    console: { log() {} },
    Blob,
    navigator: { sendBeacon: (url, blob) => { sent.push({ url, blob }); return true; } }
  });
  page.track('free_result_shown', { lifePath: 7, hasName: true });
  assert.strictEqual(sent.length, 1);
  assert.strictEqual(sent[0].url, '/track');
  const payload = JSON.parse(await sent[0].blob.text());
  assert.strictEqual(payload.event_name, 'free_result_shown');
  assert.deepStrictEqual(Object.keys(payload.meta).sort(), ['hasName', 'lifePath', 'sid']);
  assert.match(payload.meta.sid, /^[0-9a-f]{16}$/);
});

test('WI-4: every tracked event is allowlisted by the Worker; no name/birth-date values reach track()', () => {
  const html = read('public/index.html');
  const worker = read('src/index.js');
  const allow = worker.slice(worker.indexOf('new Set(['), worker.indexOf(']);'));
  const calls = html.match(/track\([^;]*\);/g) || [];
  const names = new Set(calls.map((c) => (c.match(/^track\("([a-z_]+)"/) || [])[1]).filter(Boolean));
  for (const n of ['quiz_viewed', 'date_entered', 'free_result_shown', 'sample_opened', 'tier_button_clicked', 'checkout_redirect']) {
    assert.ok(names.has(n), 'page never tracks ' + n);
  }
  for (const n of names) assert.ok(allow.includes("'" + n + "'"), n + ' is not allowlisted in src/index.js');
  for (const call of calls) {
    // Only boolean coercions (!!nameVal) may reference the raw inputs.
    assert.doesNotMatch(call, /(?<!!!)\b(dateVal|nameVal)\b|birthDate|fullName|__lp|\bval\b|\bref\b/, call);
  }
  assert.ok(html.includes('track("free_result_shown", { lifePath: lifePath, hasName: !!nameVal });'));
});
