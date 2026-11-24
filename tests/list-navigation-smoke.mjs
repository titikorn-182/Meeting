import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';
const base = process.env.WORKSPACE_BASE_URL || 'http://127.0.0.1:3101';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname));
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  for (const route of ['meetings', 'resolutions', 'tasks']) {
    await page.goto(base + '/' + route + (route === 'tasks' ? '?scope=all' : ''), {
      waitUntil: 'networkidle',
    });
    const input = page.locator('input[type=search], input[placeholder]').first();
    await expect(input).toBeVisible();
    await input.fill('ไม่มีรายการทดสอบนี้');
    await expect.poll(() => new URL(page.url()).searchParams.get('q')).toBe('ไม่มีรายการทดสอบนี้');
    await page.reload({ waitUntil: 'networkidle' });
    await expect(input).toHaveValue('ไม่มีรายการทดสอบนี้');
    await input.fill('');
    const url = page.url();
    const detail = page
      .locator('main a[href^="/' + route + '/"]:not([href$="/new"]):not([href$="/closures"])')
      .first();
    await expect(detail).toBeVisible();
    const target = await detail.getAttribute('href');
    await detail.click();
    await page.waitForURL(base + target);
    await page.goBack({ waitUntil: 'networkidle' });
    await expect(page).toHaveURL(url);
    await expect(input).toHaveValue('');
  }
  await page.goto(base + '/reports', { waitUntil: 'networkidle' });
  const unit = page.getByLabel('หน่วยงานในรายงาน', { exact: true });
  const value = await unit
    .locator('option')
    .nth(1)
    .evaluate((option) => option.value);
  await unit.selectOption(value);
  await page.reload({ waitUntil: 'networkidle' });
  await expect(unit).toHaveValue(value);
  await page.goto(base + '/resolutions?page=not-a-number', { waitUntil: 'networkidle' });
  await expect(page.locator('main')).not.toContainText('NaN');
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({ lists: 4, reload: true, back: true, invalidPage: true, runtimeErrors: 0 }),
  );
} finally {
  await browser.close();
}
