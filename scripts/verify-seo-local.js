const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3892;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const ARTIFACTS_DIR = path.join(__dirname, '..', 'artifacts');

if (!fs.existsSync(ARTIFACTS_DIR)) {
  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
}

// Simple static server for public directory
const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/') reqPath = '/index.html';
  const filePath = path.join(PUBLIC_DIR, reqPath);

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath);
    const contentTypes = {
      '.html': 'text/html; charset=utf-8',
      '.css': 'text/css',
      '.js': 'application/javascript',
      '.svg': 'image/svg+xml',
      '.xml': 'application/xml',
      '.txt': 'text/plain',
      '.json': 'application/json'
    };
    res.writeHead(200, { 'Content-Type': contentTypes[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
});

async function run() {
  await new Promise((resolve) => server.listen(PORT, '127.0.0.1', resolve));
  console.log(`Local test server running at http://127.0.0.1:${PORT}`);

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
  } catch (e) {
    browser = await chromium.launch({ channel: 'msedge', headless: true });
  }

  const context = await browser.newContext({
    viewport: { width: 375, height: 667 }
  });
  const page = await context.newPage();

  const consoleLogs = [];
  page.on('console', msg => consoleLogs.push(msg.text()));

  // 1. Check Mobile (375px)
  console.log("1. Navigating to local site at 375px...");
  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'networkidle' });
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'seo-mobile-375px.png'), fullPage: false });
  console.log("Captured artifacts/seo-mobile-375px.png");

  // 2. Check Desktop (1440px)
  console.log("2. Resizing to 1440px...");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'seo-desktop-1440px.png'), fullPage: false });
  console.log("Captured artifacts/seo-desktop-1440px.png");

  // 3. Verify Head Metadata & Schema
  console.log("3. Verifying SEO Meta Tags & Schema.org JSON-LD...");
  const title = await page.title();
  console.log("Page Title:", title);
  if (!title.includes("Life Path Number Calculator")) {
    throw new Error(`Title mismatch: ${title}`);
  }

  const metaDesc = await page.$eval('meta[name="description"]', el => el.getAttribute('content'));
  console.log("Meta Description:", metaDesc);
  if (!metaDesc || metaDesc.length < 50) {
    throw new Error("Meta description missing or too short");
  }

  const schemaJson = await page.$eval('script[type="application/ld+json"]', el => el.textContent);
  const parsedSchema = JSON.parse(schemaJson);
  console.log("Parsed Schema @graph entities:", parsedSchema['@graph'].map(e => e['@type']).join(', '));
  const expectedTypes = ['Organization', 'WebSite', 'WebApplication', 'HowTo', 'FAQPage', 'Product'];
  for (const t of expectedTypes) {
    if (!parsedSchema['@graph'].some(e => e['@type'] === t)) {
      throw new Error(`Missing schema type in graph: ${t}`);
    }
  }

  // 4. Verify Content Sections
  console.log("4. Verifying Answer-First, Methodology, Archetypes Table, FAQ, Citations...");
  await page.waitForSelector('#definition');
  await page.waitForSelector('#methodology');
  await page.waitForSelector('#archetypes');
  await page.waitForSelector('#faq');
  await page.waitForSelector('#citations');

  const faqCount = await page.$$eval('.faq-item', els => els.length);
  console.log(`Verified ${faqCount} FAQ accordion items`);
  if (faqCount < 5) throw new Error("Expected >= 5 FAQ items");

  const archetypeRows = await page.$$eval('.archetype-table tbody tr', els => els.length);
  console.log(`Verified ${archetypeRows} Archetype table rows`);
  if (archetypeRows !== 12) throw new Error(`Expected 12 archetype rows, got ${archetypeRows}`);

  // 5. Test Calculator Form Submission
  console.log("5. Testing calculator submission...");
  await page.fill('#birthDate', '1989-11-17');
  await page.fill('#fullName', 'Ada Lovelace');
  await page.click('button[type="submit"]');

  await page.waitForSelector('#resultSection', { state: 'visible' });
  const lifePathNumeral = await page.textContent('#lifePathNumeral');
  const archetypeName = await page.textContent('#archetypeName');
  console.log(`Calculation result: Life Path ${lifePathNumeral} — ${archetypeName}`);
  if (lifePathNumeral !== '1' || archetypeName !== 'The Pioneer') {
    throw new Error(`Unexpected result: expected 1 (The Pioneer), got ${lifePathNumeral} (${archetypeName})`);
  }

  // 6. Check Sitemap and Robots on server
  console.log("6. Verifying robots.txt and sitemap.xml on server...");
  const robotsRes = await page.goto(`http://127.0.0.1:${PORT}/robots.txt`);
  if (robotsRes.status() !== 200) throw new Error("robots.txt returned non-200");
  const robotsText = await robotsRes.text();
  if (!robotsText.includes("Sitemap: https://life-path.icu/sitemap.xml")) {
    throw new Error("robots.txt missing sitemap link");
  }

  const sitemapRes = await page.goto(`http://127.0.0.1:${PORT}/sitemap.xml`);
  if (sitemapRes.status() !== 200) throw new Error("sitemap.xml returned non-200");
  const sitemapText = await sitemapRes.text();
  if (!sitemapText.includes("https://life-path.icu/")) {
    throw new Error("sitemap.xml missing canonical url");
  }

  console.log("\n==========================================");
  console.log("ALL LOCAL SEO & E2E VERIFICATIONS PASSED!");
  console.log("==========================================");

  await browser.close();
  server.close();
}

run().catch(err => {
  console.error("Verification failed:", err);
  if (server) server.close();
  process.exit(1);
});
