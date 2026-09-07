const https = require('https');
const fs = require('fs');
const path = require('path');

const CLOUDFLARE_TOKEN = process.env.CLOUDFLARE_AGENT_TOKEN;
const STRIPE_KEY = process.env.STRIPE_LIVE_KEY;
const ZONE_ID = "5419db263eec756845ebf57019a4c412";

function httpsRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          resolve(body);
        }
      });
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function getStripeSales(targetDateIso) {
  if (!STRIPE_KEY) {
    return { count: 0, revenue: 0, error: "STRIPE_LIVE_KEY not set" };
  }
  const startTimestamp = Math.floor(new Date(targetDateIso + "T00:00:00Z").getTime() / 1000);
  const endTimestamp = startTimestamp + 86400;

  const endpoint = `/v1/charges?created[gte]=${startTimestamp}&created[lt]=${endTimestamp}&limit=100`;
  const options = {
    hostname: 'api.stripe.com',
    path: endpoint,
    method: 'GET',
    headers: { 'Authorization': `Bearer ${STRIPE_KEY}` }
  };

  const res = await httpsRequest(options);
  if (!res.data) {
    return { count: 0, revenue: 0, error: res.error ? res.error.message : "Unknown" };
  }

  const successfulCharges = res.data.filter(c => c.status === 'succeeded' && c.paid);
  const totalRevenueCents = successfulCharges.reduce((sum, c) => sum + (c.amount - c.amount_refunded), 0);

  return {
    count: successfulCharges.length,
    revenue: totalRevenueCents / 100
  };
}

async function getCloudflareAnalytics() {
  if (!CLOUDFLARE_TOKEN) {
    return [];
  }

  const query = JSON.stringify({
    query: `query {
      viewer {
        zones(filter: { zoneTag: "${ZONE_ID}" }) {
          httpRequests1dGroups(limit: 14, orderBy: [date_DESC], filter: { date_geq: "2026-09-01" }) {
            dimensions {
              date
            }
            sum {
              requests
              pageViews
            }
            uniq {
              uniques
            }
          }
        }
      }
    }`
  });

  const options = {
    hostname: 'api.cloudflare.com',
    path: '/client/v4/graphql',
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${CLOUDFLARE_TOKEN}`,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(query)
    }
  };

  const res = await httpsRequest(options, query);
  try {
    return res.data.viewer.zones[0].httpRequests1dGroups || [];
  } catch (e) {
    return [];
  }
}

async function run() {
  const shouldUpdate = process.argv.includes('--update-ledger');
  const today = new Date().toISOString().split('T')[0];

  console.log(`====================================================`);
  console.log(`PULLING DAILY METRICS: ${today}`);
  console.log(`====================================================`);

  const cfRecords = await getCloudflareAnalytics();
  const cfMap = {};
  for (const r of cfRecords) {
    cfMap[r.dimensions.date] = {
      pageViews: r.sum.pageViews,
      uniques: r.uniq.uniques
    };
  }

  const stripeData = await getStripeSales(today);
  const todayViews = cfMap[today] ? cfMap[today].pageViews : 0;
  const todayUniques = cfMap[today] ? cfMap[today].uniques : 0;

  console.log(`Cloudflare Views: ${todayViews} (Unique Visitors: ${todayUniques})`);
  console.log(`Stripe Live Sales: ${stripeData.count} transactions, $${stripeData.revenue.toFixed(2)} USD revenue`);

  if (shouldUpdate) {
    const ledgerPath = path.join(__dirname, '..', 'RUN-WINDOW.md');
    if (fs.existsSync(ledgerPath)) {
      let content = fs.readFileSync(ledgerPath, 'utf8');
      // Update line for today's date if present
      // Example row: | 1 | 2026-09-07 | | | | | | | | |
      const rowRegex = new RegExp(`(\\|\\s*\\d+\\s*\\|\\s*${today}\\s*\\|)([^\\n]+)`);
      if (rowRegex.test(content)) {
        const replacement = `$1 ${todayViews} | - | - | - | - | ${stripeData.count} | - | $${stripeData.revenue.toFixed(2)} |`;
        content = content.replace(rowRegex, replacement);
        fs.writeFileSync(ledgerPath, content, 'utf8');
        console.log(`Updated RUN-WINDOW.md entry for ${today}`);
      }
    }
  }

  console.log(`====================================================`);
}

run();
