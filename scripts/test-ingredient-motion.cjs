/* Browser regression checks for the shared ingredient accordion.
 * Run with the local preview server: node scripts/test-ingredient-motion.cjs
 * Requires Playwright and Microsoft Edge; does not alter source content.
 */
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const origin = process.env.BKE_PREVIEW_URL || 'http://127.0.0.1:4173';
const route = process.env.BKE_INGREDIENT_ROUTE || '/全面性服務/原料成分/index.html';
const ingredientLibrary = page => page.locator('#ingredient-library');
const readPanel = (page, id = 'materials-beauty') => page.evaluate(id => {
  const panel = document.getElementById('ingredient-library').querySelector(`#${id}`);
  const shell = panel.parentElement;
  return {
    height: shell.getBoundingClientRect().height,
    natural: panel.getBoundingClientRect().height,
    gap: Number.parseFloat(getComputedStyle(shell).marginBottom),
    hidden: shell.hidden,
    inert: panel.inert,
    opacity: Number.parseFloat(getComputedStyle(panel).opacity),
    animations: shell.getAnimations().length,
    clipped: getComputedStyle(shell).overflow === 'hidden'
  };
}, id);
const activate = (page, id) => ingredientLibrary(page).locator(`#${id} > summary`).evaluate(el => el.click());
const settle = page => page.waitForTimeout(740);

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const results = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${origin}${route}`, { waitUntil: 'networkidle' });
    await ingredientLibrary(page).locator('.ingredient-grid-ready').waitFor({ state: 'attached' });
    if (route.endsWith('/全面性服務/index.html')) {
      await page.locator('#tab-ingredients').click();
      await ingredientLibrary(page).locator('.ingredient-grid-ready').waitFor({ state: 'visible' });
    }
    await page.evaluate(() => document.fonts.ready);

    // An inserted zero-height row must not immediately add an extra grid gap.
    const initialPositions = await page.evaluate(() => {
      const root = document.getElementById('ingredient-library');
      const nextRow = root.querySelector('#category-body-functions');
      const before = nextRow.getBoundingClientRect().top;
      root.querySelector('#category-beauty > summary').click();
      return { before, after: nextRow.getBoundingClientRect().top };
    });
    const start = await readPanel(page);
    assert.ok(Math.abs(initialPositions.after - initialPositions.before) < 1, `Extra initial row gap/jump: ${JSON.stringify(initialPositions)}`);
    await page.waitForTimeout(130);
    const middle = await readPanel(page);
    assert.ok(middle.height > 0 && middle.height < middle.natural, `Opening needs a real intermediate height: ${JSON.stringify({ start, middle })}`);
    assert.equal(middle.hidden, false);
    assert.equal(middle.clipped, true);
    await settle(page);
    const end = await readPanel(page);
    assert.ok(Math.abs(end.height - end.natural) < 1, 'Open panel must restore natural height');
    assert.equal(end.clipped, false);
    results.push({ test: 'measured opening', start, middle, end });

    await activate(page, 'category-beauty');
    assert.equal((await readPanel(page)).hidden, false, 'Do not hide before closing finishes');
    await page.waitForTimeout(130);
    const closing = await readPanel(page);
    assert.ok(closing.height > 0 && closing.height < end.height, 'Closing needs an intermediate height');
    assert.equal(closing.inert, true);
    await settle(page);
    assert.equal((await readPanel(page)).hidden, true);
    results.push({ test: 'measured closing', closing });

    for (const id of ['category-beauty', 'category-secret-garden', 'category-beauty', 'category-protein', 'category-secret-garden']) {
      await activate(page, id);
      await page.waitForTimeout(65);
    }
    await settle(page);
    const final = await ingredientLibrary(page).evaluate(root => ({
      open: [...root.querySelectorAll('.ingredient-category[open]')].map(el => el.id),
      mounted: [...root.querySelectorAll('.ingredient-grid-ready > .ingredient-panel-slot:not([hidden])')].map(el => el.firstElementChild.id),
      expanded: [...root.querySelectorAll('.ingredient-category > summary[aria-expanded="true"]')].length
    }));
    assert.deepEqual(final.open, ['category-secret-garden']);
    assert.deepEqual(final.mounted, ['materials-secret-garden']);
    assert.equal(final.expanded, 1);
    results.push({ test: 'rapid alternation', ...final });

    await ingredientLibrary(page).locator('#ingredient-search').fill('葉黃素');
    await settle(page);
    assert.equal(await ingredientLibrary(page).locator('#category-generation-3c').getAttribute('open'), '');
    assert.equal(await ingredientLibrary(page).locator('#ingredient-count').textContent(), '1');
    await ingredientLibrary(page).locator('#ingredient-search').fill('no-such-material-999');
    await settle(page);
    assert.equal(await ingredientLibrary(page).locator('.ingredient-empty').isVisible(), true);
    assert.equal(await ingredientLibrary(page).locator('.ingredient-grid-ready > .ingredient-panel-slot:not([hidden])').count(), 0);
    await ingredientLibrary(page).locator('#ingredient-reset').click();
    await settle(page);
    assert.equal(await ingredientLibrary(page).locator('#category-secret-garden').getAttribute('open'), '');
    results.push({ test: 'search + empty + reset', passed: true });

    await ingredientLibrary(page).locator('#category-beauty > summary').focus();
    await page.keyboard.press('Enter');
    await settle(page);
    await ingredientLibrary(page).locator('#materials-beauty [data-close-ingredients]').click();
    assert.equal(await ingredientLibrary(page).locator('#category-beauty > summary').evaluate(el => el === document.activeElement), true);
    await settle(page);
    results.push({ test: 'keyboard activation + close focus', passed: true });

    await activate(page, 'category-beauty');
    await page.waitForTimeout(90);
    await page.setViewportSize({ width: 390, height: 844 });
    await settle(page);
    const mobile = await readPanel(page);
    assert.ok(Math.abs(mobile.height - mobile.natural) < 1, 'Resize during animation must not clip content');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    results.push({ test: 'resize during opening', mobile });

    if (await page.locator('#tab-formats').count()) {
      await activate(page, 'category-beauty');
      await settle(page);
      await page.locator('#tab-formats').evaluate(el => el.click());
      await page.waitForTimeout(250);
      await page.locator('#tab-ingredients').evaluate(el => el.click());
      await page.waitForTimeout(250);
      await activate(page, 'category-beauty');
      await page.waitForTimeout(100);
      const parent = await page.locator('.cap-tabs-panels').evaluate(el => ({
        switching: el.classList.contains('is-switching'),
        overflow: getComputedStyle(el).overflow
      }));
      assert.equal(parent.switching, false, 'Nested expansion must release the parent height transition');
      assert.equal(parent.overflow, 'visible', 'Do not clip a panel expanding during its parent tab transition');
      await page.locator('#tab-formats').evaluate(el => el.click());
      await page.waitForTimeout(250);
      assert.equal((await readPanel(page)).animations, 0, 'Hiding the parent tab must settle its accordion motion');
      await page.locator('#tab-ingredients').evaluate(el => el.click());
      await page.waitForTimeout(850);
      const returned = await readPanel(page);
      assert.ok(Math.abs(returned.height - returned.natural) < 1);
      results.push({ test: 'real parent tab interrupted + restored without clipping', parent, returned });
    }

    // Simulate the embedded parent tab without navigating or scroll assertions
    // depending on the browser's native anchor handling.
    const hidden = await page.evaluate(() => {
      const section = document.getElementById('ingredient-library');
      section.hidden = true;
      window.__ingredientScrollCalls = 0;
      window.__ingredientOriginalScrollBy = window.scrollBy;
      window.scrollBy = () => window.__ingredientScrollCalls++;
      location.hash = '#category-sleep';
      return true;
    });
    assert.equal(hidden, true);
    await page.waitForTimeout(100);
    assert.equal(await page.evaluate(() => window.__ingredientScrollCalls), 0, 'Hidden panel must not scroll');
    await page.evaluate(() => {
      document.getElementById('ingredient-library').hidden = false;
      window.dispatchEvent(new CustomEvent('bke:cap-panel-visible', { detail: { id: 'cap-panel-ingredients' } }));
      window.scrollBy = window.__ingredientOriginalScrollBy;
    });
    await settle(page);
    const revealed = await ingredientLibrary(page).evaluate(root => {
      const category = root.querySelector('#category-sleep');
      const panel = root.querySelector('#materials-sleep');
      const grid = root.querySelector('.ingredient-grid-ready');
      const expected = category.getBoundingClientRect().left - grid.getBoundingClientRect().left + category.getBoundingClientRect().width / 2;
      return { open: category.open, pointer: Number.parseFloat(panel.style.getPropertyValue('--ingredient-pointer-left')), expected, clipped: panel.parentElement.getBoundingClientRect().height < panel.getBoundingClientRect().height };
    });
    assert.equal(revealed.open, true);
    assert.ok(Math.abs(revealed.pointer - revealed.expected) < 1);
    assert.equal(revealed.clipped, false);
    results.push({ test: 'hidden parent + hash + visible event', ...revealed });

    await activate(page, 'category-beauty');
    await page.waitForTimeout(80);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForTimeout(70);
    const reduced = await readPanel(page);
    assert.equal(reduced.animations, 0, 'Changing reduced motion must cancel a running animation');
    assert.ok(Math.abs(reduced.height - reduced.natural) < 1);
    await activate(page, 'category-beauty');
    assert.equal((await readPanel(page)).hidden, true);
    results.push({ test: 'reduced motion including live change', reduced });

    await page.goto(`${origin}${route}#category-gut`, { waitUntil: 'networkidle' });
    await settle(page);
    assert.equal(await ingredientLibrary(page).locator('#category-gut').getAttribute('open'), '');
    assert.equal(await ingredientLibrary(page).locator('#materials-gut').isVisible(), true);
    await page.evaluate(() => { location.hash = '#materials-generation-3c'; });
    await settle(page);
    assert.equal(await ingredientLibrary(page).locator('#materials-generation-3c').isVisible(), true);
    assert.deepEqual(errors, []);
    results.push({ test: 'initial category hash + materials alias + no script errors', passed: true });

    const noJS = await browser.newPage({ javaScriptEnabled: false });
    await noJS.goto(`${origin}/全面性服務/原料成分/index.html`);
    await ingredientLibrary(noJS).locator('#category-beauty > summary').click();
    assert.equal(await ingredientLibrary(noJS).locator('#materials-beauty').isVisible(), true);
    results.push({ test: 'native details fallback without JavaScript', passed: true });
    console.log(JSON.stringify({ route, checks: results.length, results }, null, 2));
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
