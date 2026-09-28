const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const { ROOT, PAGE_COPIES, read, loadPageScript } = require('./helpers');

const SCRIPT = path.join(ROOT, 'scripts', 'setup-live-stripe.js');
const STUB = path.join(__dirname, 'fixtures', 'stripe-https-stub.js');
const LINK = 'https://buy.stripe.com/dRm4gyafd9zu8Ztg3o9AA03';

// The script talks to LIVE Stripe. Always run it with a scrubbed env (no inherited STRIPE_* keys).
function runScript(args, extraEnv, preload) {
  const argv = (preload ? ['-r', preload] : []).concat([SCRIPT], args);
  return spawnSync(process.execPath, argv, { env: { PATH: process.env.PATH, ...extraEnv }, encoding: 'utf8', timeout: 15000 });
}

test('WI-6: client_reference_id builder', () => {
  const { buildCheckoutUrl } = loadPageScript();
  assert.strictEqual(buildCheckoutUrl(LINK, { lifePath: 11, date: '1990-05-12' }), LINK + '?client_reference_id=lp11_19900512');
  assert.strictEqual(buildCheckoutUrl(LINK + '?utm_source=x', { lifePath: 7, date: '1985-01-02' }), LINK + '?utm_source=x&client_reference_id=lp7_19850102');
  assert.strictEqual(buildCheckoutUrl(LINK, undefined), LINK);
  assert.strictEqual(buildCheckoutUrl(LINK, {}), LINK);
  for (const bad of [{ lifePath: 11, date: '1990-5-12' }, { lifePath: 100, date: '1990-05-12' }, { lifePath: 11, date: '1990-05-12"><x' }, { lifePath: 'x', date: '1990-05-12' }]) {
    assert.strictEqual(buildCheckoutUrl(LINK, bad), LINK, JSON.stringify(bad));
  }
});

test('WI-6: buy handler stores state on submit and redirects via the builder after checkout_redirect', () => {
  for (const copy of PAGE_COPIES) {
    const html = read(copy);
    assert.ok(html.includes('window.__lp = { lifePath: lifePath, date: dateVal, hasName: !!nameVal };'), copy);
    assert.ok(html.includes('var dest = buildCheckoutUrl(link, window.__lp);\n      track("checkout_redirect", { tier: tier });\n      window.location.href = dest;'), copy);
    assert.ok(html.includes('alert("Payment link is not configured.");'), copy);
  }
});

test('WI-6: setup-live-stripe.js without a key still exits with its FATAL message (both modes)', () => {
  for (const args of [[], ['--update-existing']]) {
    const r = runScript(args, {});
    assert.strictEqual(r.status, 1, args.join(' '));
    assert.match(r.stderr, /FATAL: Please set STRIPE_LIVE_KEY/);
  }
});

test('WI-6: --update-existing requires valid plink IDs and makes no request otherwise', () => {
  for (const ids of [undefined, '', 'price_123', 'plink_ok,../x']) {
    const env = { STRIPE_LIVE_KEY: 'rk_live_stub' };
    if (ids !== undefined) env.STRIPE_PAYMENT_LINK_IDS = ids;
    const r = runScript(['--update-existing'], env, STUB);
    assert.strictEqual(r.status, 1, String(ids));
    assert.match(r.stderr, /STRIPE_PAYMENT_LINK_IDS/);
    assert.doesNotMatch(r.stdout, /STRIPE_STUB/);
  }
});

test('WI-6: --update-existing sends after_completion + full custom_fields per link and edits no files', () => {
  const hash = () => crypto.createHash('sha256').update(PAGE_COPIES.map(read).join('')).digest('hex');
  const before = hash();
  const r = runScript(['--update-existing'], { STRIPE_LIVE_KEY: 'rk_live_stub', STRIPE_PAYMENT_LINK_IDS: 'plink_A1, plink_B2' }, STUB);
  assert.strictEqual(r.status, 0, r.stderr);
  const calls = r.stdout.split('\n').filter((l) => l.startsWith('STRIPE_STUB ')).map((l) => JSON.parse(l.slice(12)));
  assert.deepStrictEqual(calls.map((c) => c.method + ' ' + c.path), ['POST /v1/payment_links/plink_A1', 'POST /v1/payment_links/plink_B2']);
  for (const call of calls) {
    const p = new URLSearchParams(call.body);
    assert.strictEqual(p.get('after_completion[type]'), 'hosted_confirmation');
    const msg = p.get('after_completion[hosted_confirmation][custom_message]');
    assert.ok(msg.includes('within 24 hours') && msg.includes('support@life-path.icu') && msg.length <= 500, msg);
    assert.strictEqual(p.get('custom_fields[0][key]'), 'full_birth_name');
    assert.strictEqual(p.get('custom_fields[0][optional]'), 'false');
    assert.strictEqual(p.get('custom_fields[1][key]'), 'birth_date');
    assert.strictEqual(p.get('custom_fields[1][type]'), 'text');
    assert.strictEqual(p.get('custom_fields[1][label][type]'), 'custom');
    assert.strictEqual(p.get('custom_fields[1][label][custom]'), 'Birth date');
    assert.strictEqual(p.get('custom_fields[1][optional]'), 'true');
    assert.strictEqual(p.get('line_items[0][price]'), null);
  }
  assert.strictEqual(hash(), before);
});
