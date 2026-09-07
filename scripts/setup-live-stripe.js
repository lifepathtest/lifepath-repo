const https = require('https');
const fs = require('fs');
const path = require('path');

const STRIPE_KEY = process.env.STRIPE_LIVE_KEY;

if (!STRIPE_KEY || !STRIPE_KEY.startsWith('rk_live_') && !STRIPE_KEY.startsWith('sk_live_')) {
  console.error("FATAL: Please set STRIPE_LIVE_KEY environment variable with a live Stripe key (rk_live_... or sk_live_...).");
  process.exit(1);
}

function stripeRequest(method, endpoint, data = null) {
  return new Promise((resolve, reject) => {
    let postData = '';
    if (data) {
      const params = new URLSearchParams();
      function buildParams(obj, prefix = '') {
        for (const key of Object.keys(obj)) {
          const val = obj[key];
          const prefixedKey = prefix ? `${prefix}[${key}]` : key;
          if (val !== null && typeof val === 'object') {
            buildParams(val, prefixedKey);
          } else if (val !== undefined) {
            params.append(prefixedKey, val);
          }
        }
      }
      buildParams(data);
      postData = params.toString();
    }

    const options = {
      hostname: 'api.stripe.com',
      port: 443,
      path: endpoint,
      method: method,
      headers: {
        'Authorization': `Bearer ${STRIPE_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            reject({ statusCode: res.statusCode, error: parsed });
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

async function run() {
  const tiers = [
    {
      key: 'score',
      name: 'Life Path Score Tier',
      amount: 199 // $1.99
    },
    {
      key: 'deep',
      name: 'Life Path Deep Report',
      amount: 399 // $3.99
    },
    {
      key: 'complete',
      name: 'Life Path Complete Archetype',
      amount: 699 // $6.99
    }
  ];

  const results = {};

  for (const tier of tiers) {
    console.log(`Creating Live Product & Price for ${tier.name} ($${(tier.amount / 100).toFixed(2)})...`);
    const price = await stripeRequest('POST', '/v1/prices', {
      unit_amount: tier.amount,
      currency: 'usd',
      product_data: {
        name: tier.name,
        tax_code: 'txcd_10000000'
      }
    });
    console.log(`Created Live Price: ${price.id}`);

    console.log(`Creating Live Payment Link for ${tier.name}...`);
    const paymentLink = await stripeRequest('POST', '/v1/payment_links', {
      line_items: [
        {
          price: price.id,
          quantity: 1
        }
      ],
      custom_fields: [
        {
          key: 'full_birth_name',
          type: 'text',
          label: {
            type: 'custom',
            custom: 'Full birth name'
          }
        },
        {
          key: 'birth_date',
          type: 'text',
          label: {
            type: 'custom',
            custom: 'Birth date'
          }
        }
      ]
    });

    console.log(`Created Live Payment Link for [${tier.key}]: ${paymentLink.url}`);
    results[tier.key] = paymentLink.url;
  }

  console.log("\n==========================================");
  console.log("GENERATED LIVE PAYMENT LINKS:");
  console.log(JSON.stringify(results, null, 2));
  console.log("==========================================\n");

  // Update files: lifepath-test.html, index.html, public/index.html, public/lifepath-test.html
  const filesToUpdate = [
    path.join(__dirname, '..', 'lifepath-test.html'),
    path.join(__dirname, '..', 'index.html'),
    path.join(__dirname, '..', 'public', 'index.html'),
    path.join(__dirname, '..', 'public', 'lifepath-test.html')
  ];

  const newConfigBlock = `paymentLinks: {
    score: "${results.score}",
    deep: "${results.deep}",
    complete: "${results.complete}"
  }`;

  for (const filePath of filesToUpdate) {
    if (fs.existsSync(filePath)) {
      let content = fs.readFileSync(filePath, 'utf8');
      content = content.replace(/paymentLinks:\s*\{[\s\S]*?\}/, newConfigBlock);
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`Updated ${path.relative(path.join(__dirname, '..'), filePath)}`);
    }
  }

  console.log("\nLive links successfully wired into all web files!");
  console.log("Next: run 'git commit' and 'wrangler pages deploy public' to publish live links.");
}

run().catch(err => {
  console.error("FATAL ERROR:", JSON.stringify(err, null, 2));
  process.exit(1);
});
