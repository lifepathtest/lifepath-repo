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
