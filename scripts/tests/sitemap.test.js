const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { ROOT, read } = require('./helpers');

test('WI-5: every sitemap <loc> resolves to an existing file in public/', () => {
  const locs = [...read('public/sitemap.xml').matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  assert.ok(locs.length > 0);
  for (const loc of locs) {
    const url = new URL(loc);
    assert.strictEqual(url.origin, 'https://life-path.icu', loc);
    const rel = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
    assert.ok(fs.existsSync(path.join(ROOT, 'public', rel)), loc + ' has no file in public/');
  }
  assert.ok(locs.includes('https://life-path.icu/terms.html'));
  assert.ok(!locs.some((l) => l.includes('/legacy')));
});

test('WI-5: root sitemap copy is in sync with public/sitemap.xml', () => {
  assert.strictEqual(read('sitemap.xml'), read('public/sitemap.xml'));
});
