import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';
const base = process.env.WORKSPACE_SMOKE_BASE_URL || 'http://127.0.0.1:3101';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
await mkdir('.test-artifacts/flow-visual', { recursive: true });
try {
  const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const go = (path) => page.goto(base + path, { waitUntil: 'networkidle' });
  await go('/meetings');
  const first = page.locator('.data-table tbody a[href^="/meetings/"]').first();
  const detail = await first.getAttribute('href');
  await first.click();
  await page.getByRole('link', { name: 'จัดการประชุมและวาระ', exact: true }).click();
  await expect(page.getByRole('heading', { name: /จัดการประชุมครั้งที่/ })).toBeVisible();
  await page.getByRole('button', { name: 'เพิ่มวาระ', exact: true }).click();
  await page.locator('#new-agenda-number').fill('99.1');
  await page.locator('#new-agenda-title').fill('วาระทดสอบการติดตาม');
  await page.getByRole('button', { name: 'บันทึกวาระ', exact: true }).click();
  await page.waitForURL(base + detail);
  await expect(
    page.getByRole('heading', { name: 'วาระทดสอบการติดตาม', exact: true }),
  ).toBeVisible();
  const agendaBlock = page
    .getByRole('heading', { name: 'วาระทดสอบการติดตาม', exact: true })
    .locator('..');
  await agendaBlock.getByRole('link', { name: 'บันทึกมติในวาระนี้', exact: true }).click();
  await expect(page.locator('#resolution-meeting')).toHaveValue(detail.split('/').at(-1));
  await expect(page.locator('#resolution-agenda')).toHaveValue('99.1');
  await go(detail + '/manage');
  await page.getByRole('button', { name: 'เชื่อมมติเดิม', exact: true }).click();
  const option = page.locator('#followup-agenda option').filter({ hasText: '99.1' });
  const agendaId = await option.getAttribute('value');
  await page.locator('#followup-agenda').selectOption(agendaId);
  const resolutionOption = page.locator('#followup-resolution option').nth(1);
  const resolutionId = await resolutionOption.getAttribute('value');
  const countBefore = await page.evaluate(
    () => JSON.parse(localStorage.getItem('polubu-ui-demo-v1')).state.resolutions.length,
  );
  await page.locator('#followup-resolution').selectOption(resolutionId);
  await page.locator('#followup-note').fill('นำมาติดตามความก้าวหน้าในการประชุมครั้งนี้');
  await page.locator('form').getByRole('button', { name: 'เชื่อมมติเดิม', exact: true }).click();
  await page.waitForURL(base + detail);
  await expect(
    page.getByText('นำมาติดตามความก้าวหน้าในการประชุมครั้งนี้', { exact: true }),
  ).toBeVisible();
  await page.reload({ waitUntil: 'networkidle' });
  assert.equal(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem('polubu-ui-demo-v1')).state.resolutions.length,
    ),
    countBefore,
  );
  await go(detail + '/manage');
  await page.locator('#edit-title').fill('ประชุมที่ปรับข้อมูลแล้ว');
  await page.locator('#edit-location').fill('ห้องประชุมใหม่');
  await page.locator('#edit-status').selectOption('completed');
  await page.locator('#edit-reason').fill('ปรับข้อมูลตามกำหนดการที่ยืนยัน');
  await page.getByRole('button', { name: 'บันทึกการแก้ไข', exact: true }).click();
  await page.waitForURL(base + detail);
  await expect(page.getByText('ประชุมที่ปรับข้อมูลแล้ว', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('ห้องประชุมใหม่', { exact: true })).toBeVisible();
  await go('/resolutions/closures');
  await expect(page.getByRole('heading', { name: 'มติรอรับรองปิด', exact: true })).toBeVisible();
  const closure = page.getByRole('link', { name: 'ตรวจเกณฑ์', exact: true }).first();
  await expect(closure).toBeVisible();
  await closure.click();
  await expect(page.locator('#resolution-closure')).toBeVisible();
  for (const width of [1366, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const [name, path] of [
      ['meeting-manage', detail + '/manage'],
      ['meeting-detail', detail],
      ['closures', '/resolutions/closures'],
      ['help', '/help'],
    ]) {
      await go(path);
      await page.evaluate(() => document.fonts.ready);
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
        false,
        `${name} overflow ${width}`,
      );
      await page.screenshot({
        path: `.test-artifacts/flow-visual/${name}-${width}.png`,
        fullPage: true,
      });
    }
  }
  // Existing staff restrictions still reject management routes.
  await go('/tasks');
  await page.getByLabel('มุมมองบทบาททดลอง').selectOption('staff');
  await go(detail + '/manage');
  await expect(
    page.getByRole('heading', { name: 'คุณไม่มีสิทธิเข้าถึงหน้านี้', exact: true }),
  ).toBeVisible();
  await expect(page.locator('#edit-title')).toHaveCount(0);
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      addAgenda: true,
      meetingContextPreserved: true,
      linkExistingWithoutDuplication: true,
      persisted: true,
      editMeeting: true,
      closureQueue: true,
      staffDenied: true,
      viewports: 2,
      runtimeErrors: 0,
    }),
  );
} finally {
  await browser.close();
}
