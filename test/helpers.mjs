import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const testDir = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.resolve(testDir, '..');
export const fixtureDir = path.join(testDir, 'fixtures');
export const outputDir = path.join(testDir, '.output');
export const screenshotDir = path.join(testDir, 'screenshots');

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

export function typst() {
  return process.env.TYPST || 'typst';
}

export function compileFixture(name, format = 'html') {
  mkdirSync(outputDir, { recursive: true });
  const input = path.join(fixtureDir, `${name}.typ`);
  const out = path.join(outputDir, `${name}.${format}`);
  const args = ['compile', '--root', repoRoot];
  if (format === 'html') args.push('--features', 'html', '--format', 'html');
  args.push(input, out);
  try {
    execFileSync(typst(), args, { stdio: 'pipe' });
  } catch (error) {
    const detail = error.stderr?.toString().trim() || error.message;
    throw new Error(`typst failed for ${name}: ${detail}`);
  }
  return out;
}

export function serve(dir) {
  const root = path.resolve(dir);
  const server = createServer((req, res) => {
    try {
      const url = new URL(req.url || '/', 'http://localhost');
      const relative = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
      const file = path.resolve(root, '.' + relative);
      if (file !== root && !file.startsWith(root + path.sep)) {
        res.writeHead(403).end('forbidden');
        return;
      }
      if (!statSync(file).isFile()) {
        res.writeHead(404).end('not found');
        return;
      }
      res.writeHead(200, {
        'content-type': mime[path.extname(file)] || 'application/octet-stream',
        'cache-control': 'no-store',
      });
      res.end(readFileSync(file));
    } catch {
      res.writeHead(404).end('not found');
    }
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({ server, base: `http://127.0.0.1:${port}` });
    });
  });
}

export async function pageState(page) {
  return page.evaluate(() => {
    const nav = document.querySelector('.mytemplate-toc');
    const backdrop = document.querySelector('.mytemplate-toc-backdrop');
    const opener = document.querySelector('.mytemplate-toc-open');
    const openerWrap = document.querySelector('.mytemplate-toc-opener');
    const close = document.querySelector('.mytemplate-toc-close');
    const grip = document.querySelector('.mytemplate-toc-grip');
    const style = (element) => (element ? getComputedStyle(element) : null);
    const navRect = nav ? nav.getBoundingClientRect() : null;
    const transform = nav ? style(nav).transform : 'none';
    const matrix = transform === 'none' ? null : new DOMMatrixReadOnly(transform);
    const raw = getComputedStyle(document.documentElement).getPropertyValue('--mytemplate-toc-progress').trim();
    return {
      progress: raw === '' ? null : Number(raw),
      state: nav ? nav.getAttribute('data-state') : null,
      inert: nav ? Boolean(nav.inert) : null,
      translateX: matrix ? Math.round(matrix.m41 * 100) / 100 : 0,
      navWidth: navRect ? Math.round(navRect.width) : null,
      navRight: navRect ? Math.round(navRect.right) : null,
      bodyPadding: parseFloat(getComputedStyle(document.body).paddingInlineStart) || 0,
      openerDisplay: style(openerWrap)?.display || null,
      closeDisplay: style(close)?.display || null,
      gripDisplay: style(grip)?.display || null,
      gripOpacity: grip ? getComputedStyle(grip).opacity : null,
      backdropDisplay: style(backdrop)?.display || null,
      backdropOpacity: backdrop ? Number(getComputedStyle(backdrop).opacity) : null,
      backdropPointer: style(backdrop)?.pointerEvents || null,
      navDisplay: style(nav)?.display || null,
      aria: nav
        ? {
            label: nav.getAttribute('aria-label'),
            openerExpanded: opener?.getAttribute('aria-expanded') ?? null,
            closeExpanded: close?.getAttribute('aria-expanded') ?? null,
          }
        : null,
    };
  });
}

export async function waitForState(page, state, timeout = 3000) {
  await page.waitForFunction(
    (expected) => document.querySelector('.mytemplate-toc')?.getAttribute('data-state') === expected,
    state,
    { timeout },
  );
}

export async function waitForProgress(page, expected, tolerance = 0.02, timeout = 3000) {
  await page.waitForFunction(
    ({ expected, tolerance }) => {
      const raw = getComputedStyle(document.documentElement).getPropertyValue('--mytemplate-toc-progress').trim();
      return raw !== '' && Math.abs(Number(raw) - expected) <= tolerance;
    },
    { expected, tolerance },
    { timeout },
  );
}

const touchSessions = new WeakMap();

export async function startTouchDrag(page, x, y) {
  let cdp = touchSessions.get(page);
  if (!cdp) {
    cdp = await page.context().newCDPSession(page);
    touchSessions.set(page, cdp);
  }
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x, y, id: 1 }],
  });
  return {
    async move(nextX, nextY = y) {
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x: nextX, y: nextY, id: 1 }],
      });
    },
    async end() {
      // Keep the session attached: detaching it resets Chromium's touch
      // emulation back to a fine pointer and hides the touch controls.
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    },
  };
}

export async function touchDrag(page, from, to, steps = 10) {
  const drag = await startTouchDrag(page, from.x, from.y);
  for (let i = 1; i <= steps; i += 1) {
    await drag.move(
      from.x + ((to.x - from.x) * i) / steps,
      from.y + ((to.y - from.y) * i) / steps,
    );
  }
  await drag.end();
}

export async function screenshot(page, name) {
  mkdirSync(screenshotDir, { recursive: true });
  await page.screenshot({ path: path.join(screenshotDir, `${name}.png`) });
}
