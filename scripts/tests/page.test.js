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
