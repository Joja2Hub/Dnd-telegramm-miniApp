const { chromium } = require('./fx-qa/node_modules/playwright');
const fs = require('node:fs');
const path = require('node:path');

const outDir = path.join(__dirname, 'fx-library-review');
fs.mkdirSync(outDir, { recursive: true });
const base = 'http://127.0.0.1:8000/cosmetics-preview/';
const errors = [];
const assert = (condition, message) => { if (!condition) throw new Error(message); };

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1080 }, deviceScaleFactor: 1.5 });
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => [...document.querySelectorAll('.avatar-shell img')].every(img => img.complete && img.naturalWidth));
    assert(await page.locator('.effect-card').count() === 25, 'Expected 25 new effects');
    const ids = await page.locator('.effect-card').evaluateAll(cards => cards.map(card => card.dataset.effectId));
    const results = [];

    for (const id of ids) {
      const card = page.locator(`[data-effect-id="${id}"]`);
      await card.scrollIntoViewIfNeeded();
      const sample = () => card.locator('canvas').evaluateAll(canvases => canvases.map(canvas => {
        const ctx = canvas.getContext('2d');
        const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        let active = 0, sum = 0, centerAlpha = 0;
        for (let i = 0; i < pixels.length; i += 4) {
          if (pixels[i + 3] > 8) active++;
          sum = (sum + pixels[i] * 3 + pixels[i + 1] * 5 + pixels[i + 2] * 7 + pixels[i + 3] * 11) % 2147483647;
        }
        centerAlpha = ctx.getImageData(Math.floor(canvas.width / 2), Math.floor(canvas.height / 2), 1, 1).data[3];
        return { active, sum, centerAlpha, cornerAlpha: pixels[3] };
      }));
      const before = await sample();
      await card.hover();
      await page.waitForTimeout(420);
      const after = await sample();
      assert(after.some(layer => layer.active > 20), `${id}: blank effect`);
      assert(after.every(layer => layer.cornerAlpha === 0), `${id}: opaque canvas`);
      assert(after.every(layer => layer.centerAlpha === 0), `${id}: covered portrait center`);
      assert(before.some((layer, i) => layer.sum !== after[i].sum), `${id}: no animation`);
      await page.mouse.move(1, 1);
      await page.waitForTimeout(80);
      const frozen = await sample();
      await page.waitForTimeout(170);
      const stillFrozen = await sample();
      assert(frozen.every((layer, i) => layer.sum === stillFrozen[i].sum), `${id}: did not pause`);
      results.push({ id, activePixels: after.map(layer => layer.active), animated: true, paused: true });
    }

    for (const [category, label] of [['mystic','Мистика'], ['violet','Фиолетовая магия'], ['cryo','Крио'], ['electro','Электро']]) {
      await page.getByRole('button', { name: new RegExp(`^${label} ·`) }).click();
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(150);
      await page.screenshot({ path: path.join(outDir, `${category}-desktop.png`), fullPage: true });
    }
    await page.getByRole('button', { name: /^Фиолетовая магия ·/ }).click();
    await page.locator('[data-effect-id="amethyst-nebula"]').click();
    await page.waitForTimeout(750);
    await page.screenshot({ path: path.join(outDir, 'nebula-dialog.png') });
    await page.getByRole('button', { name: 'Следующий эффект', exact: true }).click();
    assert(await page.locator('#dialog-title').innerText() === 'Эфирный дым', 'Dialog navigation failed');
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(outDir, 'smoke-dialog.png') });
    await page.getByRole('button', { name: 'Закрыть', exact: true }).click();
    await page.getByRole('button', { name: /^Все ·/ }).click();
    assert(await page.locator('.effect-card').count() === 36, 'Original effects missing');
    await page.getByRole('searchbox').fill('телепат');
    assert(await page.locator('.effect-card').count() === 1, 'Search failed');
    await page.getByRole('searchbox').fill('no-matching-effect-739');
    assert(await page.locator('#empty-state').isVisible(), 'Empty state failed');
    await page.getByRole('searchbox').fill('');
    await page.getByLabel('Портрет для проверки').selectOption('cyber');
    await page.getByLabel('Игровой размер аватара').selectOption('48');
    await page.getByLabel('Фон проверки').selectOption('stone');
    await page.waitForFunction(() => [...document.querySelectorAll('.avatar-shell img')].every(img => img.complete && img.naturalWidth));
    assert(await page.locator('.avatar-shell.is-loaded').count() === 36, 'Avatar switch failed');
    await page.getByRole('button', { name: /^Электро ·/ }).click();
    await page.screenshot({ path: path.join(outDir, 'electro-light-48.png'), fullPage: true });

    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    mobile.on('pageerror', error => errors.push(error.message));
    await mobile.goto(base + '?category=violet', { waitUntil: 'networkidle' });
    assert(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Mobile horizontal overflow');
    await mobile.screenshot({ path: path.join(outDir, 'mobile.png') });
    await mobile.locator('[data-effect-id="amethyst-nebula"]').click();
    await mobile.waitForTimeout(500);
    await mobile.screenshot({ path: path.join(outDir, 'mobile-dialog.png') });
    assert(await mobile.locator('#dialog-close').isVisible(), 'Mobile close button not visible');
    assert(await mobile.evaluate(() => {
      const dialog = document.querySelector('dialog');
      return dialog.scrollWidth <= dialog.clientWidth + 1;
    }), 'Mobile dialog horizontal overflow');
    assert(errors.length === 0, `Browser errors: ${errors.join('; ')}`);
    fs.writeFileSync(path.join(outDir, 'verification.json'), JSON.stringify({ effects: results, errors, total: 36, mobile: 'ok' }, null, 2));
    console.log(JSON.stringify({ verifiedNewEffects: results.length, totalEffects: 36, browserErrors: errors, mobile: 'ok', screenshots: outDir }, null, 2));
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
