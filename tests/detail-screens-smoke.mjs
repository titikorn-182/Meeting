import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';

// Exercise extracted screen controllers through real UI events in isolated demo storage.
// This suite never signs in, sends invitations, or mutates a hosted database.
const base = process.env.WORKSPACE_SMOKE_BASE_URL || 'http://127.0.0.1:3101';
const browser = await chromium.launch({
  channel: process.env.AUTH_BROWSER_CHANNEL || 'chrome',
  headless: true,
});
try {
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const go = (path) => page.goto(`${base}${path}`, { waitUntil: 'networkidle' });
  const picker = page.getByLabel('มุมมองบทบาททดลอง');
  const state = () =>
    page.evaluate(() => JSON.parse(localStorage.getItem('polubu-ui-demo-v1')).state);
  const main = page.locator('#main-content');
  const button = (name) => main.getByRole('button', { name, exact: true });

  await go('/team');
  await page.locator('#team-tab-permissions').click();
  await page.locator('#permission-role').selectOption('staff');
  await page.getByRole('checkbox', { name: 'Staff เข้าถึงหน้างานของฉัน', exact: true }).check();
  const saveStaff = button('บันทึกสิทธิ์ Staff');
  if (await saveStaff.isEnabled()) await saveStaff.click();
  await expect(saveStaff).toBeDisabled();

  // A policy update from another tab invalidates this tab's unsaved draft.
  await page.locator('#permission-role').selectOption('user');
  const draftPage = page.getByRole('checkbox', { name: 'User เข้าถึงหน้าการประชุม', exact: true });
  await draftPage.setChecked(!(await draftPage.isChecked()));
  await expect(button('บันทึกสิทธิ์ User')).toBeEnabled();
  const other = await context.newPage();
  other.on('pageerror', (error) => errors.push(error.message));
  await other.goto(`${base}/team`, { waitUntil: 'networkidle' });
  await other.locator('#team-tab-permissions').click();
  await other.locator('#permission-role').selectOption('user');
  const remotePage = other.getByRole('checkbox', { name: 'User เข้าถึงหน้ารายงาน', exact: true });
  await remotePage.setChecked(!(await remotePage.isChecked()));
  await other.getByRole('button', { name: 'บันทึกสิทธิ์ User', exact: true }).click();
  await expect(main.getByText(/สิทธิ์มีการเปลี่ยนแปลงจากที่อื่น/)).toBeVisible();
  await expect(button('บันทึกสิทธิ์ User')).toBeDisabled();
  await expect(page.locator('#permission-role')).toHaveValue('user');
  await other.close();

  await picker.selectOption('staff');
  await go('/tasks/t02');
  await button('รายงานความก้าวหน้า').click();
  await page.locator('#task-progress').fill('70');
  await page.locator('#progress-note').fill('รายงานจากหน้าที่แยกส่วนแล้ว');
  await button('บันทึกรายงาน').click();
  await expect(page.locator('#progress-note')).toHaveCount(0);
  await expect
    .poll(async () => (await state()).tasks.find((task) => task.id === 't02').progress)
    .toBe(70);

  await button('เพิ่มลิงก์').click();
  await page.locator('#evidence-title').fill('หลักฐานทดสอบ');
  await page.locator('#evidence-url').fill('ftp://example.test/blocked');
  const evidenceCount = (await state()).tasks.find((task) => task.id === 't02').evidence.length;
  await button('เพิ่มหลักฐาน').click();
  await expect(page.locator('.toast-region')).toContainText('ลิงก์ไม่ถูกต้อง');
  assert.equal(
    (await state()).tasks.find((task) => task.id === 't02').evidence.length,
    evidenceCount,
  );
  await page.locator('#evidence-url').fill('https://example.test/evidence');
  await button('เพิ่มหลักฐาน').click();
  await expect(page.locator('#evidence-url')).toHaveCount(0);
  await expect(main.getByText('หลักฐานทดสอบ', { exact: true })).toBeVisible();

  // Navigate with Next links, so drafts must reset without a full browser reload.
  await button('รายงานความก้าวหน้า').click();
  await page.locator('#progress-note').fill('แบบร่างของ t02 ที่ยังไม่บันทึก');
  await main.getByRole('link', { name: 'งานตามมติ', exact: true }).click();
  const secondTask = (await state()).tasks.find((task) => task.id === 't03');
  await main.getByRole('link', { name: secondTask.title, exact: true }).click();
  await expect(page.locator('#progress-note')).toHaveCount(0);
  await button('รายงานความก้าวหน้า').click();
  await expect(page.locator('#progress-note')).toHaveValue('');

  await go('/tasks/t02');
  await button('ส่งผลงานตรวจรับ').click();
  await page.locator('#submission-note').fill('ส่งหลักฐานที่บันทึกแล้ว');
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'ยืนยันส่งตรวจ', exact: true })
    .click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect
    .poll(async () => (await state()).tasks.find((task) => task.id === 't02').status)
    .toBe('submitted');

  await picker.selectOption('admin');
  // Query parameters open the assignment form on first render, including direct links.
  await go('/resolutions/r01?addTask=1');
  await expect(page.locator('#task-title')).toBeVisible();
  await page.locator('#task-title').fill('งานทดสอบส่วนมอบหมาย');
  await page.locator('#task-owner').selectOption('u-thanaphorn');
  await page.locator('#task-description').fill('รายละเอียดงานทดสอบ');
  await page.locator('#task-deliverable').fill('รายงานผลทดสอบ');
  await page.locator('#task-criteria').fill('ตรวจครบถ้วน\nแนบหลักฐานครบ');
  await main.locator('form').getByRole('button', { name: 'มอบหมายงาน', exact: true }).click();
  await expect(page.locator('#task-title')).toHaveCount(0);
  await expect(main.getByRole('link', { name: /งานทดสอบส่วนมอบหมาย/ })).toBeVisible();
  const created = (await state()).tasks.find((task) => task.title === 'งานทดสอบส่วนมอบหมาย');
  assert.equal(created.resolutionId, 'r01');
  assert.deepEqual(created.criteria, ['ตรวจครบถ้วน', 'แนบหลักฐานครบ']);

  await go('/resolutions/r03');
  await button('ตรวจเกณฑ์และรับรองปิด').click();
  const confirm = button('ยืนยันรับรองปิดมติ');
  await expect(confirm).toBeDisabled();
  const checks = main.locator('input[type=checkbox]');
  assert.equal(await checks.count(), 2);
  for (const check of await checks.all()) await check.check();
  await expect(confirm).toBeEnabled();
  await confirm.click();
  await expect(confirm).toHaveCount(0);
  await expect
    .poll(async () => (await state()).resolutions.find((r) => r.id === 'r03').status)
    .toBe('closed');
  await page.reload({ waitUntil: 'networkidle' });
  await expect(button('ตรวจเกณฑ์และรับรองปิด')).toHaveCount(0);
  assert.deepEqual(errors, [], 'Extracted screens must not cause browser runtime errors');
  console.log(
    JSON.stringify({
      stalePolicyDraftReset: true,
      progressSaved: true,
      invalidLinkDenied: true,
      evidenceSaved: true,
      navigationResetsDraft: true,
      workSubmitted: true,
      queryAssignmentCreated: true,
      closureRequiresChecks: true,
      closurePersisted: true,
      runtimeErrors: errors.length,
    }),
  );
} finally {
  await browser.close();
}
