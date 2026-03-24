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

test('ladder method: correct answer advances the bird', async ({ page }, testInfo) => {
  await page.goto('/', { waitUntil: 'networkidle' });
  await page.click('#start-btn');

  // Challenge 1: 13 × 2
  // Row 0: digit=1, 1×2=2, trailing "0"  → type "2"
  // Row 1: digit=3, 3×2=6, trailing ""   → type "6"
  // Total: 26
  await page.fill('#partial-0', '2');
  await page.keyboard.press('Enter');
  await page.fill('#partial-1', '6');
  await page.keyboard.press('Enter');
  await page.fill('#total-input', '26');
  await page.keyboard.press('Enter');

  // Bird should hop (wait for transition + render next challenge)
  await expect(page.locator('#partial-0')).toBeVisible({ timeout: 3000 });

  await page.screenshot({ path: `test-results/${testInfo.project.name}-after-level1.png`, fullPage: false });
});
