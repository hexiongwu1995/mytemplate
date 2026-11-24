import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import {
  compileFixture,
  outputDir,
  pageState,
  repoRoot,
  screenshot,
  serve,
  startTouchDrag,
  touchDrag,
  waitForProgress,
  waitForState,
} from './helpers.mjs';

const packageDir = repoRoot;
const linksSelector = '.mytemplate-toc-link';

let browser;
let server;
let base;

before(async () => {
  for (const name of ['sidebar', 'sidebar-off', 'sidebar-custom-title']) {
    compileFixture(name);
  }
  compileFixture('print-default', 'svg');
  compileFixture('print-off', 'svg');
  ({ server, base } = await serve(outputDir));
  browser = await chromium.launch();
});

after(async () => {
  await browser?.close();
  await new Promise((resolve) => server?.close(resolve));
});

async function openPage(file, options = {}) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    ...options,
  });
  const page = await context.newPage();
  await page.goto(`${base}/${file}`);
  if (file !== 'sidebar-off.html') {
    await page.waitForSelector(linksSelector, { state: 'attached' });
  }
  return { context, page };
}

async function outline(page) {
  return page.$$eval(linksSelector, (nodes) =>
    nodes.map((link) => ({
      text: link.textContent.trim(),
      href: link.getAttribute('href'),
      level: Number(link.getAttribute('data-level')),
      depth: link.style.getPropertyValue('--mytemplate-toc-depth'),
      current: link.getAttribute('aria-current'),
    })),
  );
}

async function waitForPadding(page, expected, timeout = 3000) {
  await page.waitForFunction(
    (value) => Math.abs((parseFloat(getComputedStyle(document.body).paddingInlineStart) || 0) - value) < 1,
    expected,
    { timeout },
  );
}

test('package metadata and every source reference use the new name and version', () => {
  const manifest = readFileSync(path.join(packageDir, 'typst.toml'), 'utf8');
  assert.match(manifest, /^name = "mytemplate"$/m);
  assert.match(manifest, /^version = "0\.3\.0"$/m);

  const oldName = ['let', 'meout'].join('');
  const offenders = [];
  const skipped = new Set(['.git', 'node_modules', 'test']);
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (skipped.has(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile() && /\.(typ|toml|md)$/.test(entry.name)) {
        if (new RegExp(oldName, 'i').test(readFileSync(full, 'utf8'))) offenders.push(path.relative(packageDir, full));
        if (new RegExp(oldName, 'i').test(entry.name)) offenders.push(path.relative(packageDir, full));
      }
    }
  };
  walk(packageDir);
  assert.deepEqual(offenders, [], `old package name still appears in: ${offenders.join(', ')}`);
});

test('desktop: sidebar is open by default with a complete outline', async () => {
  const { context, page } = await openPage('sidebar.html');
  try {
    const state = await pageState(page);
    assert.equal(state.state, 'open');
    assert.ok(state.progress !== null && Math.abs(state.progress - 1) < 0.001);
    assert.equal(state.inert, false);
    assert.equal(state.translateX, 0);
    assert.ok(state.navWidth >= 250, `sidebar width ${state.navWidth}`);
    assert.ok(state.bodyPadding >= state.navWidth, `body padding ${state.bodyPadding}`);
    assert.equal(state.openerDisplay, 'none');
    assert.equal(state.closeDisplay, 'grid');
    assert.equal(state.aria.label, 'Contents');

    const items = await outline(page);
    assert.deepEqual(
      items.map((item) => item.text),
      [
        '1. Introduction',
        '1.1. Background',
        '1.1.1. Details',
        '1.2. Scope',
        '2. Methods',
        '2.1. Sampling',
        '3. Results',
        '3.1. Measurements',
        '4. Conclusion',
      ],
    );
    assert.deepEqual(items.map((item) => item.level), [2, 3, 4, 3, 2, 3, 2, 3, 2]);
    assert.deepEqual(items.map((item) => item.depth), ['0', '1', '2', '1', '0', '1', '0', '1', '0']);

    const targetCheck = await page.$$eval(linksSelector, (nodes) => ({
      missing: nodes
        .filter((link) => !document.getElementById(decodeURIComponent(link.hash.slice(1))))
        .map((link) => link.hash),
      unique: new Set(nodes.map((link) => link.hash)).size === nodes.length,
    }));
    assert.deepEqual(targetCheck.missing, []);
    assert.equal(targetCheck.unique, true);

    await screenshot(page, 'desktop-open');
  } finally {
    await context.close();
  }
});

test('desktop: close button collapses, opener restores, and Escape closes', async () => {
  const { context, page } = await openPage('sidebar.html');
  try {
    await page.click('.mytemplate-toc-close');
    await waitForState(page, 'closed');
    await waitForPadding(page, 0);
    await page.waitForTimeout(400);

    let state = await pageState(page);
    assert.equal(state.state, 'closed');
    assert.ok(state.progress === 0);
    assert.equal(state.inert, true);
    assert.equal(state.bodyPadding, 0);
    assert.equal(state.openerDisplay, 'block');
    assert.ok(state.navRight <= 0, `closed sidebar right edge ${state.navRight}`);
    assert.equal(state.aria.openerExpanded, 'false');
    await screenshot(page, 'desktop-closed');

    await page.click('.mytemplate-toc-open');
    await waitForState(page, 'open');
    await waitForPadding(page, state.navWidth);
    await page.waitForTimeout(400);
    state = await pageState(page);
    assert.equal(state.inert, false);
    assert.equal(state.translateX, 0);
    assert.equal(state.openerDisplay, 'none');

    await page.keyboard.press('Escape');
    await waitForState(page, 'closed');
    assert.equal((await pageState(page)).inert, true);
  } finally {
    await context.close();
  }
});

test('desktop: outline links scroll to their headings and scroll-spy marks the section', async () => {
  const { context, page } = await openPage('sidebar.html');
  try {
    await page.evaluate(() => {
      document.documentElement.style.scrollBehavior = 'auto';
      window.scrollTo(0, document.documentElement.scrollHeight);
    });
    await page.waitForTimeout(350);
    const activeAtBottom = await page.$$eval(linksSelector, (nodes) =>
      nodes.filter((link) => link.getAttribute('aria-current') === 'location').map((link) => link.textContent.trim()),
    );
    assert.deepEqual(activeAtBottom, ['4. Conclusion']);

    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(200);
    const link = page.getByRole('link', { name: '2. Methods' });
    const href = await link.getAttribute('href');
    await link.click();
    await page.waitForTimeout(700);

    const position = await page.evaluate((id) => {
      const heading = document.getElementById(decodeURIComponent(id.slice(1)));
      return { top: heading.getBoundingClientRect().top, y: window.scrollY };
    }, href);
    assert.ok(position.y > 0, 'clicking an outline link should scroll the page');
    assert.ok(position.top >= -2 && position.top < 60, `heading top ${position.top}`);

    const current = await page.$$eval(linksSelector, (nodes, target) =>
      nodes.find((link) => link.getAttribute('href') === target)?.getAttribute('aria-current'),
    href);
    // The heading at the top of the viewport can be its subsection.
    const active = await page.$$eval(linksSelector, (nodes) =>
      nodes.filter((link) => link.getAttribute('aria-current') === 'location').map((link) => link.textContent.trim()),
    );
    assert.equal(active.length, 1);
    assert.ok(current === 'location' || active[0].startsWith('2.'), `active ${active[0]}`);
  } finally {
    await context.close();
  }
});

test('desktop: print styles hide the sidebar and remove page padding', async () => {
  const { context, page } = await openPage('sidebar.html');
  try {
    await page.emulateMedia({ media: 'print' });
    await waitForPadding(page, 0);
    await page.waitForTimeout(400);
    const state = await pageState(page);
    assert.equal(state.navDisplay, 'none');
    assert.equal(state.openerDisplay, 'none');
    assert.equal(state.backdropDisplay, 'none');
    assert.equal(state.gripDisplay, 'none');
    assert.equal(state.bodyPadding, 0);
  } finally {
    await context.close();
  }
});

test('desktop: resizing across 64rem follows the large/small default', async () => {
  const { context, page } = await openPage('sidebar.html', { viewport: { width: 1024, height: 900 } });
  try {
    await waitForState(page, 'open');
    await page.setViewportSize({ width: 1023, height: 900 });
    await waitForState(page, 'closed');
    await waitForPadding(page, 0);

    await page.setViewportSize({ width: 1024, height: 900 });
    await waitForState(page, 'open');
    await waitForPadding(page, 273);
  } finally {
    await context.close();
  }
});

test('toc: false removes the sidebar, its styles, and its script', async () => {
  const { context, page } = await openPage('sidebar-off.html');
  try {
    const result = await page.evaluate(() => ({
      nav: Boolean(document.querySelector('.mytemplate-toc')),
      scripts: document.querySelectorAll('script').length,
      variable: getComputedStyle(document.documentElement)
        .getPropertyValue('--mytemplate-toc-progress')
        .trim(),
      padding: parseFloat(getComputedStyle(document.body).paddingInlineStart) || 0,
      headings: document.querySelectorAll('h1, h2, h3').length,
    }));
    assert.deepEqual(result, { nav: false, scripts: 0, variable: '', padding: 0, headings: 3 });
  } finally {
    await context.close();
  }
});

test('toc dictionary changes the sidebar title and accessible name', async () => {
  const { context, page } = await openPage('sidebar-custom-title.html');
  try {
    const state = await pageState(page);
    assert.equal(await page.textContent('.mytemplate-toc-title'), '目录');
    assert.equal(state.aria.label, '目录');
    await screenshot(page, 'desktop-custom-title');
  } finally {
    await context.close();
  }
});

test('paged output is unchanged by the sidebar option', () => {
  const hash = (name) =>
    createHash('sha256')
      .update(readFileSync(path.join(outputDir, name)))
      .digest('hex');
  assert.equal(hash('print-default.svg'), hash('print-off.svg'));
});

async function mobilePage() {
  return openPage('sidebar.html', {
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 2,
  });
}

async function waitForSettledOpen(page) {
  await page
    .waitForFunction(
      () => {
        const nav = document.querySelector('.mytemplate-toc');
        const grip = document.querySelector('.mytemplate-toc-grip');
        const transform = nav ? getComputedStyle(nav).transform : 'none';
        const offset = transform === 'none' ? 0 : new DOMMatrixReadOnly(transform).m41;
        return (
          nav?.getAttribute('data-state') === 'open' &&
          Math.abs(offset) < 0.5 &&
          (!grip || Number(getComputedStyle(grip).opacity) < 0.05)
        );
      },
      undefined,
      { timeout: 5000 },
    )
    .catch(async (error) => {
      const detail = await pageState(page);
      throw new Error(`sidebar did not settle: ${JSON.stringify(detail)}\n${error.message}`);
    });
}

test('touch tablet: wide screen opens by default and swipes closed', async () => {
  const { context, page } = await openPage('sidebar.html', {
    viewport: { width: 1200, height: 900 },
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 2,
  });
  try {
    await waitForState(page, 'open');
    await waitForPadding(page, 273);
    await page.waitForTimeout(400);
    let state = await pageState(page);
    assert.equal(state.state, 'open');
    assert.equal(state.openerDisplay, 'none');
    assert.equal(state.closeDisplay, 'none');
    assert.equal(state.gripDisplay, 'block');
    assert.equal(await page.evaluate(() => matchMedia('(pointer: coarse)').matches), true);
    await screenshot(page, 'tablet-open');

    const drag = await startTouchDrag(page, 250, 420);
    await drag.move(20, 420);
    await drag.end();
    await waitForState(page, 'closed');
    await waitForPadding(page, 0);
    await page.waitForTimeout(400);
    state = await pageState(page);
    assert.equal(state.state, 'closed');
    assert.equal(state.inert, true);
    assert.ok(state.navRight <= 0);
  } finally {
    await context.close();
  }
});

test('mobile: starts closed with touch controls and an off-screen panel', async () => {
  const { context, page } = await mobilePage();
  try {
    const state = await pageState(page);
    assert.equal(state.state, 'closed');
    assert.ok(state.progress === 0);
    assert.equal(state.inert, true);
    assert.equal(state.bodyPadding, 0);
    assert.equal(state.openerDisplay, 'none');
    assert.equal(state.closeDisplay, 'none');
    assert.equal(state.gripDisplay, 'block');
    assert.equal(state.backdropDisplay, 'block');
    assert.equal(state.backdropPointer, 'none');
    assert.ok(state.navRight <= 0, `closed panel right edge ${state.navRight}`);
    assert.equal(await page.evaluate(() => matchMedia('(pointer: coarse)').matches), true);
    await screenshot(page, 'mobile-closed');
  } finally {
    await context.close();
  }
});

test('mobile: swiping right follows the finger and opens the panel', async () => {
  const { context, page } = await mobilePage();
  try {
    const initial = await pageState(page);
    const drag = await startTouchDrag(page, 20, 420);

    await drag.move(40, 420);
    const first = await pageState(page);
    assert.ok(first.progress > 0, `progress after 20px ${first.progress}`);
    assert.equal(first.state, 'closed');
    assert.ok(first.backdropPointer === 'auto');

    await drag.move(120, 420);
    await page.waitForTimeout(30);
    const middle = await pageState(page);
    const expected = 100 / initial.navWidth;
    assert.ok(
      Math.abs(middle.progress - expected) < 0.03,
      `mid-drag progress ${middle.progress}, expected ${expected}`,
    );
    assert.ok(
      Math.abs(middle.translateX - -initial.navWidth * (1 - middle.progress)) < 4,
      `panel translate ${middle.translateX} does not follow progress ${middle.progress}`,
    );
    assert.ok(Math.abs(middle.backdropOpacity - middle.progress) < 0.06);
    assert.equal(middle.bodyPadding, 0);
    assert.equal(middle.state, 'closed');
    await screenshot(page, 'mobile-drag');

    await drag.move(250, 420);
    const late = await pageState(page);
    assert.ok(late.progress > middle.progress, 'progress should keep increasing with the finger');
    await drag.end();

    await waitForState(page, 'open');
    await waitForProgress(page, 1);
    await waitForSettledOpen(page);
    const opened = await pageState(page);
    assert.equal(opened.inert, false);
    assert.ok(Math.abs(opened.translateX) < 1, `open translate ${opened.translateX}`);
    assert.equal(opened.backdropPointer, 'auto');
    assert.ok(Number(opened.gripOpacity) < 0.05);
    assert.equal(opened.bodyPadding, 0);
    await screenshot(page, 'mobile-open');
  } finally {
    await context.close();
  }
});

test('mobile: swiping left closes the open panel and snaps by position', async () => {
  const { context, page } = await mobilePage();
  try {
    await touchDrag(page, { x: 20, y: 420 }, { x: 260, y: 420 });
    await waitForState(page, 'open');
    await waitForSettledOpen(page);

    const drag = await startTouchDrag(page, 200, 420);
    await drag.move(100, 420);
    await page.waitForTimeout(30);
    await page.waitForFunction(
      () =>
        Number(
          getComputedStyle(document.documentElement)
            .getPropertyValue('--mytemplate-toc-progress')
            .trim(),
        ) < 0.99,
    );
    const middle = await pageState(page);
    assert.equal(middle.state, 'open');
    assert.ok(middle.progress > 0.5 && middle.progress < 1, `closing progress ${middle.progress}`);
    assert.ok(Math.abs(middle.backdropOpacity - middle.progress) < 0.06);

    await drag.move(20, 420);
    await drag.end();
    await waitForState(page, 'closed');
    await page.waitForTimeout(400);
    const closed = await pageState(page);
    assert.equal(closed.inert, true);
    assert.equal(closed.progress, 0);
    assert.equal(closed.bodyPadding, 0);
    assert.equal(closed.backdropPointer, 'none');

    // A short drag from closed snaps back instead of opening.
    await touchDrag(page, { x: 20, y: 420 }, { x: 100, y: 420 });
    await page.waitForTimeout(400);
    assert.equal((await pageState(page)).state, 'closed');

    // A long drag from closed snaps open.
    await touchDrag(page, { x: 20, y: 420 }, { x: 240, y: 420 });
    await waitForState(page, 'open');
  } finally {
    await context.close();
  }
});

test('mobile: backdrop and outline links close the panel, vertical swipes do not', async () => {
  const { context, page } = await mobilePage();
  try {
    await touchDrag(page, { x: 20, y: 420 }, { x: 260, y: 420 });
    await waitForState(page, 'open');
    await waitForSettledOpen(page);
    await page.waitForTimeout(400);

    await page.mouse.click(370, 420);
    await waitForState(page, 'closed');
    await page.waitForTimeout(400);

    await touchDrag(page, { x: 20, y: 420 }, { x: 260, y: 420 });
    await waitForState(page, 'open');
    await waitForSettledOpen(page);
    await page.waitForTimeout(400);

    const before = await page.evaluate(() => window.scrollY);
    await page.getByRole('link', { name: '2. Methods' }).tap();
    await waitForState(page, 'closed');
    await page.waitForFunction((start) => window.scrollY > start, before, { timeout: 3000 });
    const after = await page.evaluate(() => window.scrollY);
    assert.ok(after > before, 'tapping an outline link should scroll the page');

    await touchDrag(page, { x: 200, y: 640 }, { x: 204, y: 260 }, 12);
    await page.waitForTimeout(250);
    assert.equal((await pageState(page)).state, 'closed');
  } finally {
    await context.close();
  }
});
