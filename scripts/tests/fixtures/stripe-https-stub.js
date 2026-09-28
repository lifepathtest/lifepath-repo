// Test-only preload (node -r): replaces https.request so setup-live-stripe.js can never reach Stripe.
// Each intercepted call is echoed as a STRIPE_STUB line and answered with a minimal Payment Link body.
const https = require('https');
const { EventEmitter } = require('events');

https.request = (options, onResponse) => {
  const req = new EventEmitter();
  let body = '';
  req.write = (chunk) => { body += chunk; };
  req.end = () => {
    process.stdout.write('STRIPE_STUB ' + JSON.stringify({ method: options.method, path: options.path, body }) + '\n');
    const params = new URLSearchParams(body);
    const res = new EventEmitter();
    res.statusCode = 200;
    onResponse(res);
    res.emit('data', JSON.stringify({
      id: options.path.split('/').pop(),
      after_completion: { type: params.get('after_completion[type]') },
      custom_fields: [{ key: params.get('custom_fields[1][key]'), optional: params.get('custom_fields[1][optional]') === 'true' }]
    }));
    res.emit('end');
  };
  return req;
};
