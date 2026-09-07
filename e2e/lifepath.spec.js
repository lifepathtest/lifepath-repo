const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

test.describe('Life Path Launch Verification', () => {
  const artifactsDir = path.join(__dirname, '..', 'artifacts');
  if (!fs.existsSync(artifactsDir)) {
    fs.mkdirSync(artifactsDir, { recursive: true });
  }

  test('E2E validation on https://lifepath-repo.pages.dev/', async ({ page }) => {
    const consoleEvents = [];
    page.on('console', msg => {
      const text = msg.text();
      if (text.startsWith('lifepath:')) {
        consoleEvents.push(text);
      }
    });

    // 1. Mobile Viewport 375px
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('https://lifepath-repo.pages.dev/', { waitUntil: 'networkidle' });
    await page.screenshot({ path: path.join(artifactsDir, 'mobile-375.png') });

    expect(consoleEvents).toContain('lifepath:quiz_viewed');

    // 2. Desktop Viewport 1440px
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.screenshot({ path: path.join(artifactsDir, 'desktop-1440.png') });

    // 3. Form submission
    await page.fill('#birthDate', '1990-10-15');
    await page.fill('#fullName', 'Ada Lovelace');
    await page.click('button[type="submit"]');

    await expect(page.locator('#resultSection')).toBeVisible();
    await expect(page.locator('#lifePathNumeral')).toHaveText('8');
    await expect(page.locator('#archetypeName')).toHaveText('The Strategist');

    const hasFreeResultEvent = consoleEvents.some(e => e.includes('lifepath:free_result_shown'));
    expect(hasFreeResultEvent).toBe(true);

    await page.screenshot({ path: path.join(artifactsDir, 'result-shown.png') });

    // 4. Verify all 3 tier buttons and destinations
    const expected = {
      score: 'https://buy.stripe.com/test_bJe3cx1uP2HC69naqlaMU00',
      deep: 'https://buy.stripe.com/test_eVq00lehB0zu2XbeGBaMU01',
      complete: 'https://buy.stripe.com/test_fZubJ32yT3LGapDfKFaMU02'
    };

    // Evaluate window.CONFIG directly in browser
    const pageConfig = await page.evaluate(() => window.CONFIG ? window.CONFIG.paymentLinks : null);
    expect(pageConfig).toEqual(expected);

    // Click score button and verify event
    await page.click('.buy[data-tier="score"]');
    const hasTierClickEvent = consoleEvents.some(e => e.includes('lifepath:tier_button_clicked'));
    expect(hasTierClickEvent).toBe(true);

    // 5. Verify prefers-reduced-motion CSS rule
    const hasReducedMotionRule = await page.evaluate(() => {
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
    expect(hasReducedMotionRule).toBe(true);
  });
});
