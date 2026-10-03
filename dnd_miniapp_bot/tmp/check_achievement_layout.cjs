const { chromium } = require('C:/Users/erush/AppData/Local/OpenAI/Codex/runtimes/cua_node/13827bafdc0b5422/bin/node_modules/playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({headless: true, executablePath: 'C:/Users/erush/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe'});
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.route('https://telegram.org/**', route => route.abort());
    await page.goto('http://127.0.0.1:8765/?local_tg_id=464302752&campaign_id=4');
    await page.locator('.bottom-nav').waitFor();
    await page.evaluate(() => { clearInterval(state.autoRefreshTimer); state.openSections.add('achievement-library'); setTab('achievements'); });
    await page.locator('.achievement-template-card').first().waitFor();
    for (const width of [1280, 390, 320]) {
      await page.setViewportSize({width, height: 900});
      await page.locator('[data-section-key="achievement-library"]').scrollIntoViewIfNeeded();
      await page.locator('.achievement-template-card').first().scrollIntoViewIfNeeded();
      await page.waitForTimeout(200);
      const cardProblems = await page.locator('.achievement-template-card').evaluateAll(cards => cards.flatMap(card => {
        const icon = card.querySelector('.ach-icon').getBoundingClientRect();
        const text = card.querySelector('.ach-main').getBoundingClientRect();
        const img = card.querySelector('img')?.getBoundingClientRect();
        const rect = card.getBoundingClientRect();
        const problems = [];
        if (icon.right > text.left) problems.push('icon overlaps text');
        if (img && (img.right > icon.right + 1 || img.bottom > icon.bottom + 1)) problems.push('image exceeds icon');
        if (text.right > rect.right || card.scrollWidth > card.clientWidth + 2) problems.push('card overflow');
        return problems.map(problem => ({title: card.innerText, problem}));
      }));
      assert.deepEqual(cardProblems, [], `Cards at ${width}: ${JSON.stringify(cardProblems)}`);
      await page.screenshot({path: `tmp/achievement-library-fixed-${width}.png`});
      await page.locator('.achievement-template-card').filter({hasText: 'Мастер Пафоса'}).click();
      await page.locator('#achievementPlayerSearch:enabled').waitFor();
      const modalProblems = await page.locator('.achievement-grant-modal').evaluate(modal => {
        const rect = modal.getBoundingClientRect();
        return {
          pageOverflow: document.documentElement.scrollWidth > innerWidth,
          modalOverflow: modal.scrollWidth > modal.clientWidth + 2,
          outOfViewport: rect.left < 0 || rect.right > innerWidth,
          players: modal.querySelectorAll('.grantMultiPlayer').length,
          firstIcon: modal.querySelector('.ach-icon').getBoundingClientRect().width,
        };
      });
      assert.equal(modalProblems.pageOverflow, false, JSON.stringify(modalProblems));
      assert.equal(modalProblems.modalOverflow, false, JSON.stringify(modalProblems));
      assert.equal(modalProblems.outOfViewport, false, JSON.stringify(modalProblems));
      assert.ok(modalProblems.players > 1);
      const submitRect = await page.locator('#grantAchievementSubmit').boundingBox();
      assert.ok(submitRect.y >= 0 && submitRect.y + submitRect.height <= 900, 'Primary action must stay visible');
      await page.screenshot({path: `tmp/achievement-grant-fixed-${width}.png`});
      await page.locator('#achievementPlayerSearch').fill('9000000001');
      assert.equal(await page.locator('.achievement-grant-target:visible').count(), 1);
      await page.locator('#grantSelectAll').check();
      assert.equal(await page.locator('.grantMultiPlayer:checked').count(), 1);
      assert.equal(await page.locator('#grantAchievementSubmit').isEnabled(), true);
      await page.locator('.achievement-grant-modal .modal-close').click();
      console.log(JSON.stringify({width, cardProblems, ...modalProblems}));
    }
    await page.locator('.achievement-template-card').filter({hasText: 'Мастер Пафоса'}).click();
    await page.locator('#achievementPlayerSearch:enabled').waitFor();
    await page.locator('#achievementPlayerSearch').fill('9000000001');
    await page.locator('#grantSelectAll').check();
    const responsePromise = page.waitForResponse(r => r.url().includes('/grant-many') && r.request().method() === 'POST');
    await page.locator('#grantAchievementSubmit').click();
    const response = await responsePromise;
    assert.equal(response.status(), 200);
    const result = await response.json();
    assert.equal(result.grants.length, 1);
    assert.equal(result.grants[0].telegram_user_id, 9000000001);
    assert.equal(result.grants[0].character_id, null);
    assert.deepEqual(errors, []);
    console.log('Browser grant to account without a character passed; no JS errors.');
    await page.locator('.achievement-grant-modal').waitFor({state: 'detached'});
    await page.locator('.achievement-create > summary').click();
    await page.locator('.achievement-create').scrollIntoViewIfNeeded();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({path: 'tmp/achievement-create-fixed-320.png'});
    await page.goto('http://127.0.0.1:8765/?local_tg_id=1029098597&local_character_id=14&campaign_id=4');
    await page.locator('.bottom-nav').waitFor();
    await page.evaluate(() => {clearInterval(state.autoRefreshTimer); setTab('achievements');});
    await page.locator('.achievement-row-card').first().waitFor();
    for (const width of [1280, 390, 320]) {
      await page.setViewportSize({width, height: 900});
      const problems = await page.locator('.achievement-row-card').evaluateAll(cards => cards.flatMap(card => {
        const icon = card.querySelector('.achievement-row-icon').getBoundingClientRect();
        const text = card.querySelector('.achievement-row-text').getBoundingClientRect();
        const img = card.querySelector('img')?.getBoundingClientRect();
        return icon.right > text.left || (img && img.right > text.left) || card.scrollWidth > card.clientWidth + 2 ? [card.innerText] : [];
      }));
      assert.deepEqual(problems, []);
      await page.screenshot({path: `tmp/achievement-player-fixed-${width}.png`});
    }
    console.log('Creation form and player achievement rows passed.');
  } finally {
    await browser.close();
  }
})().catch(error => {console.error(error); process.exitCode = 1;});
