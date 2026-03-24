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

  // Wait for game screen and first digit box of first partial row
  await expect(page.locator('#game-screen')).toBeVisible();
  await expect(page.locator('#partial-0-0')).toBeVisible();

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
  // Row 0: placeValue=10, answer=10×2=20 → sig digits = "2" (1 box), trailing zero = 1
  // Row 1: placeValue=3,  answer=3×2=6   → sig digits = "6" (1 box), trailing zero = 0
  // Total: 26 → 2 boxes: "2" and "6"

  // Row 0: sig digit "2" → partial-0-0
  await setInputValue(page, '#partial-0-0', '2');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(150);

  // Row 1: sig digit "6" → partial-1-0
  await setInputValue(page, '#partial-1-0', '6');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(150);

  // Total: 26 → total-0="2", total-1="6"
  await setInputValue(page, '#total-0', '2');
  await setInputValue(page, '#total-1', '6');
  await page.click('#check-btn');

  // Bird should hop (wait for transition + render next challenge)
  await expect(page.locator('#partial-0-0')).toBeVisible({ timeout: 3000 });

  await page.screenshot({ path: `test-results/${testInfo.project.name}-after-level1.png`, fullPage: false });
});
