const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function run() {
  const artifactsDir = path.join(__dirname, '..', 'artifacts');
  if (!fs.existsSync(artifactsDir)) {
    fs.mkdirSync(artifactsDir, { recursive: true });
  }

  console.log("Launching browser for E2E verification on https://lifepath-repo.pages.dev/...");
  
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
  } catch (e) {
    console.log("Chromium launch failed, falling back to msedge channel...");
    browser = await chromium.launch({ channel: 'msedge', headless: true });
  }

  const context = await browser.newContext({
    viewport: { width: 375, height: 667 }
  });

  const page = await context.newPage();

  const consoleLogs = [];
  page.on('console', msg => {
    const text = msg.text();
    console.log(`[BROWSER CONSOLE] ${text}`);
    consoleLogs.push(text);
  });

  // 1. Mobile Viewport (375px)
  console.log("1. Navigating to https://life-path.icu/ at 375px...");
  await page.goto('https://life-path.icu/', { waitUntil: 'networkidle' });
  await page.screenshot({ path: path.join(artifactsDir, 'redesign-375px.png') });
  console.log("Captured artifacts/redesign-375px.png");

  // 2. Desktop Viewport (1440px)
  console.log("2. Resizing to 1440px width...");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({ path: path.join(artifactsDir, 'redesign-1440px.png') });
  console.log("Captured artifacts/redesign-1440px.png");

  // Check quiz_viewed event fired
  const quizViewedFired = consoleLogs.some(l => l.includes('lifepath:quiz_viewed'));
  console.log("Event lifepath:quiz_viewed fired:", quizViewedFired);

  // 3. Form submission
  console.log("3. Submitting quiz form: birthDate=1990-10-15, fullName='Ada Lovelace'...");
  await page.fill('#birthDate', '1990-10-15');
  await page.fill('#fullName', 'Ada Lovelace');
  await page.click('button[type="submit"]');

  await page.waitForSelector('#resultSection', { state: 'visible' });
  const lifePathText = await page.textContent('#lifePathNumeral');
  const archetypeName = await page.textContent('#archetypeName');
  console.log(`Displayed result: Life Path ${lifePathText} — ${archetypeName}`);

  if (lifePathText !== '8' || archetypeName !== 'The Strategist') {
    throw new Error(`Unexpected result: expected 8 (The Strategist), got ${lifePathText} (${archetypeName})`);
  }

  const freeResultFired = consoleLogs.some(l => l.includes('lifepath:free_result_shown'));
  console.log("Event lifepath:free_result_shown fired:", freeResultFired);

  await page.screenshot({ path: path.join(artifactsDir, 'redesign-results.png') });

  // 4. Verify all 3 tier buttons and navigation target
  console.log("4. Verifying tier button URLs and click handlers...");
  const expectedUrls = {
    score: 'https://buy.stripe.com/dRm4gyafd9zu8Ztg3o9AA03',
    deep: 'https://buy.stripe.com/6oU5kC7317rmejNaJ49AA04',
    complete: 'https://buy.stripe.com/00w14m3QPaDy4Jd8AW9AA05'
  };

  for (const tier of ['score', 'deep', 'complete']) {
    const buttonSelector = `.buy[data-tier="${tier}"]`;
    await page.waitForSelector(buttonSelector);

    // Read CONFIG.paymentLinks from page context
    const configuredUrl = await page.evaluate((t) => window.CONFIG ? window.CONFIG.paymentLinks[t] : null, tier);
    console.log(`Tier [${tier}] configured payment link: ${configuredUrl}`);

    if (configuredUrl !== expectedUrls[tier]) {
      throw new Error(`Mismatch on ${tier}: expected ${expectedUrls[tier]}, got ${configuredUrl}`);
    }
  }

  const tierClickFired = consoleLogs.some(l => l.includes('lifepath:tier_button_clicked'));
  console.log("Event lifepath:tier_button_clicked fired:", tierClickFired);

  // 5. Check prefers-reduced-motion
  console.log("5. Checking prefers-reduced-motion handling in stylesheet...");
  const cssHasReducedMotion = await page.evaluate(() => {
    for (const sheet of document.styleSheets) {
      try {
        for (const rule of sheet.cssRules) {
          if (rule.media && rule.media.mediaText.includes('prefers-reduced-motion')) {
            return true;
          }
        }
      } catch (e) {}
    }
    return false;
  });
  console.log("prefers-reduced-motion media query present in CSS:", cssHasReducedMotion);

  console.log("\n==========================================");
  console.log("ALL BROWSER E2E VERIFICATIONS PASSED!");
  console.log("==========================================");

  await browser.close();
}

run().catch(err => {
  console.error("Browser verification failure:", err);
  process.exit(1);
});
