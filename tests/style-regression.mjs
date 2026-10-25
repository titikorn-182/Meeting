import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium, expect } from '@playwright/test';

const base = process.env.WORKSPACE_SMOKE_BASE_URL || 'http://127.0.0.1:3101';
const phase = process.env.STYLE_PHASE || 'after';
assert.ok(['before', 'after'].includes(phase));
const directory = resolve('.test-artifacts', 'phase6-visual');
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({
  channel: process.env.AUTH_BROWSER_CHANNEL || 'chrome',
  headless: true,
});
const routes = [
  ['dashboard', '/', 'ภาพรวมการติดตามมติ'],
  ['resolutions', '/resolutions', 'ทะเบียนมติ'],
  ['reports', '/reports', 'รายงานและผลดำเนินงาน'],
  ['settings', '/settings', 'ตั้งค่าและประวัติระบบ'],
  ['team', '/team', 'บุคลากรและสิทธิ์การใช้งาน'],
];
try {
  const mismatches = [];
  for (const width of [1366, 390]) {
    const context = await browser.newContext({
      viewport: { width, height: width === 390 ? 844 : 900 },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    for (const [name, route, heading] of routes) {
      await page.goto(base + route, { waitUntil: 'networkidle' });
      await expect(
        page.locator('#main-content').getByRole('heading', { name: heading, exact: true }),
      ).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });
      const styles = await page.evaluate(() => {
        const selectors = [
          'body',
          '.sidebar',
          '.topbar',
          '.main-content',
          '.page-header',
          '.panel',
          '.data-table',
          '.overview-metric',
          '.button',
        ];
        const properties = [
          'color',
          'backgroundColor',
          'fontFamily',
          'fontSize',
          'lineHeight',
          'display',
          'width',
          'padding',
          'gap',
          'borderColor',
          'borderRadius',
        ];
        return selectors.flatMap((selector) =>
          Array.from(document.querySelectorAll(selector)).map((element) => {
            const computed = getComputedStyle(element);
            return {
              selector,
              style: Object.fromEntries(
                properties.map((property) => [property, computed[property]]),
              ),
            };
          }),
        );
      });
      const stem = `${name}-${width}`;
      await page.screenshot({
        path: resolve(directory, `${stem}-${phase}-full.png`),
        fullPage: true,
        animations: 'disabled',
      });
      const png = await page.screenshot({
        path: resolve(directory, `${stem}-${phase}.png`),
        animations: 'disabled',
      });
      const json = JSON.stringify(styles, null, 2);
      await writeFile(resolve(directory, `${stem}-${phase}.json`), json);
      if (phase === 'after') {
        assert.equal(
          await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
          false,
          `Page must not scroll horizontally: ${stem}`,
        );
        assert.equal(
          json,
          await readFile(resolve(directory, `${stem}-before.json`), 'utf8'),
          `Computed styles changed: ${stem}`,
        );
        if (!png.equals(await readFile(resolve(directory, `${stem}-before.png`))))
          mismatches.push(stem);
      }
    }
    assert.deepEqual(errors, []);
    await context.close();
  }
  assert.deepEqual(
    mismatches,
    [],
    'Rendered screenshots differ; inspect the paired images before accepting changes',
  );
  console.log(
    JSON.stringify({
      phase,
      screenshots: routes.length * 2,
      computedStylesMatch: phase === 'after',
      pixelMatches: phase === 'after',
    }),
  );
} finally {
  await browser.close();
}
