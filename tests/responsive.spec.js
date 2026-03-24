const { test, expect } = require('@playwright/test');

test('start screen fits viewport', async ({ page }, testInfo) => {
  await page.goto('/', { waitUntil: 'networkidle' });

  // Start screen should be visible
  await expect(page.locator('#start-screen')).toBeVisible();

  // No horizontal or vertical overflow
  const overflow = await page.evaluate(() => ({
    scrollWidth:  document.documentElement.scrollWidth,
    scrollHeight: document.documentElement.scrollHeight,
    innerWidth:   window.innerWidth,
    innerHeight:  window.innerHeight,
  }));
  expect(overflow.scrollWidth,  'no horizontal overflow').toBeLessThanOrEqual(overflow.innerWidth  + 2);
  expect(overflow.scrollHeight, 'no vertical overflow').toBeLessThanOrEqual(overflow.innerHeight + 2);

  await page.screenshot({ path: `test-results/${testInfo.project.name}-start.png`, fullPage: false });
});

test('game screen (first challenge) fits viewport', async ({ page }, testInfo) => {
  await page.goto('/', { waitUntil: 'networkidle' });
  await page.click('#start-btn');

  // Wait for game screen and first ladder input
  await expect(page.locator('#game-screen')).toBeVisible();
  await expect(page.locator('#partial-0')).toBeVisible();

  // No overflow
  const overflow = await page.evaluate(() => ({
    scrollWidth:  document.documentElement.scrollWidth,
    scrollHeight: document.documentElement.scrollHeight,
    innerWidth:   window.innerWidth,
    innerHeight:  window.innerHeight,
  }));
  expect(overflow.scrollWidth,  'no horizontal overflow').toBeLessThanOrEqual(overflow.innerWidth  + 2);
  expect(overflow.scrollHeight, 'no vertical overflow').toBeLessThanOrEqual(overflow.innerHeight + 2);

  // Bird and tree visible
  await expect(page.locator('#bird-wrapper')).toBeVisible();
  await expect(page.locator('#tree-svg')).toBeVisible();

  await page.screenshot({ path: `test-results/${testInfo.project.name}-game.png`, fullPage: false });
});

/**
 * Helper: set an input's value directly via JS (works even on readOnly numpad-mode inputs).
 * This simulates what the custom numpad does.
 */
async function setInputValue(page, selector, value) {
  await page.evaluate(({ sel, val }) => {
    const el = document.querySelector(sel);
    if (!el) throw new Error('Element not found: ' + sel);
    el.value = val;
  }, { sel: selector, val: value });
}

test('ladder method: correct answer advances the bird', async ({ page }, testInfo) => {
  await page.goto('/', { waitUntil: 'networkidle' });
  await page.click('#start-btn');

  // Challenge 1: 13 × 2
  // Row 0: placeValue=10, answer=10×2=20  → type "20"
  // Row 1: placeValue=3,  answer=3×2=6    → type "6"
  // Total: 26
  // Use evaluate-based fill to support both desktop (editable) and mobile (readOnly numpad mode)
  await setInputValue(page, '#partial-0', '20');
  await page.keyboard.press('Enter');

  // After row 0's Enter, the input is replaced with a partial-display.
  // Wait a moment for the DOM update, then fill row 1.
  await page.waitForTimeout(100);
  await setInputValue(page, '#partial-1', '6');
  await page.keyboard.press('Enter');

  // After row 1's Enter, total-input is enabled. Wait for it.
  await page.waitForTimeout(100);
  await setInputValue(page, '#total-input', '26');
  await page.keyboard.press('Enter');

  // Bird should hop (wait for transition + render next challenge)
  await expect(page.locator('#partial-0')).toBeVisible({ timeout: 3000 });

  await page.screenshot({ path: `test-results/${testInfo.project.name}-after-level1.png`, fullPage: false });
});
