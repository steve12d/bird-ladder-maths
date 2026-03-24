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

  // Challenges are random — read correct answers from data-answer attributes
  // stamped on each digit box by the game itself.

  // Collect all partial digit boxes grouped by row
  const partialRows = await page.evaluate(() => {
    const rows = [];
    let r = 0;
    while (document.getElementById(`partial-${r}-0`)) {
      const boxes = [];
      let d = 0;
      while (document.getElementById(`partial-${r}-${d}`)) {
        const el = document.getElementById(`partial-${r}-${d}`);
        boxes.push({ id: `#partial-${r}-${d}`, answer: el.dataset.answer });
        d++;
      }
      rows.push(boxes);
      r++;
    }
    return rows;
  });

  // Fill and submit each partial row
  for (const row of partialRows) {
    for (const { id, answer } of row) {
      await setInputValue(page, id, answer);
    }
    await page.keyboard.press('Enter');
    await page.waitForTimeout(150);
  }

  // Collect and fill total boxes (data-answer already stamped on each)
  const totalBoxes = await page.evaluate(() => {
    const boxes = [];
    let d = 0;
    while (document.getElementById(`total-${d}`)) {
      const el = document.getElementById(`total-${d}`);
      boxes.push({ id: `#total-${d}`, answer: el.dataset.answer });
      d++;
    }
    return boxes;
  });
  for (const { id, answer } of totalBoxes) {
    await setInputValue(page, id, answer);
  }
  await page.click('#check-btn');

  // Bird should hop (wait for next challenge to render)
  await expect(page.locator('#partial-0-0')).toBeVisible({ timeout: 4000 });

  await page.screenshot({ path: `test-results/${testInfo.project.name}-after-level1.png`, fullPage: false });
});
