import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';

// Isolated demo context: no real user's cookies/localStorage and no hosted credentials.
const base = process.env.WORKSPACE_SMOKE_BASE_URL || 'http://127.0.0.1:3000';
const browser = await chromium.launch({ channel: process.env.AUTH_BROWSER_CHANNEL || 'chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${base}/meetings`, { waitUntil: 'networkidle' });
  await expect(page.getByLabel('มุมมองบทบาททดลอง')).toBeVisible();
  await page.getByRole('button', { name: 'สร้างการประชุม', exact: true }).click();
  await page.locator('#meeting-title').fill('การประชุมทดสอบ async adapter');
  await page.locator('#meeting-committee').fill('คณะกรรมการทดสอบ');
  await page.locator('#meeting-number').fill('TEST/2569');
  await page.locator('#meeting-location').fill('ห้องทดสอบ');
  await page.locator('#meeting-agenda').fill('วาระทดสอบที่หนึ่ง\nวาระทดสอบที่สอง');
  await page.getByRole('button', { name: 'บันทึกการประชุม', exact: true }).click();
  await page.waitForURL(/\/meetings\/meeting-[^/]+$/);
  await expect(page.getByRole('heading', { name: 'การประชุมครั้งที่ TEST/2569' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'วาระทดสอบที่สอง', exact: true })).toBeVisible();
  await page.reload({ waitUntil: 'networkidle' });
  await expect(page.getByRole('heading', { name: 'วาระทดสอบที่หนึ่ง', exact: true })).toBeVisible();
  await page.getByLabel('มุมมองบทบาททดลอง').selectOption('reviewer');
  await page.goto(`${base}/reviews`, { waitUntil: 'networkidle' });
  await page.getByLabel('เฉพาะงานที่ฉันเป็นผู้ตรวจ').check();
  const criteria = page.locator('fieldset input[type=checkbox]');
  assert.ok(await criteria.count() > 0, 'Demo must provide a pending assigned review');
  for (const check of await criteria.all()) await check.check();
  await page.locator('#review-note').fill('ตรวจครบตามเกณฑ์จาก browser smoke test');
  const firstTitle = await page.locator('.stack .panel h2').first().textContent();
  await page.getByRole('button', { name: 'รับรองผลงาน', exact: true }).click();
  await expect(page.locator('.toast-region')).toContainText('รับรองผลงานแล้ว');
  assert.deepEqual(errors, [], 'Async adapter flow must not raise browser runtime errors');
  console.log(JSON.stringify({ meetingCreatedWithAgendas: true, reloadPersisted: true, reviewAccepted: firstTitle, runtimeErrors: errors.length }));
  await page.close();
} finally { await browser.close(); }
