import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';

// Isolated demo context: no real user's cookies/localStorage and no hosted credentials.
const base = process.env.WORKSPACE_SMOKE_BASE_URL || 'http://127.0.0.1:3000';
const browser = await chromium.launch({ channel: process.env.AUTH_BROWSER_CHANNEL || 'chrome', headless: true });
const labels = {
  dashboard: 'ภาพรวม', meetings: 'การประชุม', resolutions: 'ทะเบียนมติ', tasks: 'งานของฉัน',
  reviews: 'ตรวจผลและรับรอง', changes: 'คำขอเปลี่ยนแปลง', reports: 'รายงาน',
  team: 'บุคลากรและสิทธิ์', settings: 'การตั้งค่า', notifications: 'แจ้งเตือน',
};
const roleLabels = { admin: 'Admin', user: 'User', executive: 'Executive', staff: 'Staff' };

try {
  const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const picker = page.getByLabel('มุมมองบทบาททดลอง');
  const main = page.locator('#main-content');
  const go = path => page.goto(`${base}${path}`, { waitUntil: 'networkidle' });
  const rawDemo = () => page.evaluate(() => JSON.parse(localStorage.getItem('polubu-ui-demo-v1')).state);
  async function persona(role) {
    await picker.selectOption(role);
    await expect(picker).toHaveValue(role);
  }
  async function configurePages(role, pages) {
    await persona('admin');
    await go('/team');
    await page.locator('#team-tab-permissions').click();
    await page.locator('#permission-role').selectOption(role);
    for (const [key, label] of Object.entries(labels)) {
      await page.getByRole('checkbox', { name: `${roleLabels[role]} เข้าถึงหน้า${label}`, exact: true }).setChecked(pages.includes(key));
    }
    const save = page.getByRole('button', { name: `บันทึกสิทธิ์ ${roleLabels[role]}`, exact: true });
    if (await save.isEnabled()) {
      await save.click();
      await expect(page.getByText(`บันทึกสิทธิ์ของ ${roleLabels[role]} แล้ว`, { exact: true })).toBeVisible();
      await expect(save).toBeDisabled();
    }
  }

  await go('/team');
  await expect(picker).toHaveValue('admin');
  assert.deepEqual(await picker.locator('option').evaluateAll(options => options.map(option => option.value)), ['admin', 'user', 'executive', 'staff']);
  await expect(page.getByLabel('บทบาทการเข้าถึงของ ศิริพร ใจมั่น', { exact: true })).toBeDisabled();
  const baseline = await rawDemo();

  // A role without configured pages has no workspace links and must not loop at '/'.
  for (const role of ['user', 'executive']) {
    await persona(role);
    await go('/');
    await expect(main.getByRole('heading', { name: 'ยังไม่ได้กำหนดหน้าใช้งานสำหรับบทบาทนี้', exact: true })).toBeVisible();
    await expect(page.locator('.sidebar .sidebar-nav a')).toHaveCount(0);
    await expect(page.locator('a[href^="/"]')).toHaveCount(0);
    await expect(picker).toHaveValue(role);
    assert.equal(new URL(page.url()).pathname, '/');
  }

  // Configure real policies through Admin UI, including summary-only task context.
  await configurePages('user', ['resolutions']);
  await persona('user');
  await go('/resolutions/new');
  await expect(main.getByRole('heading', { name: 'บันทึกมติใหม่', exact: true })).toBeVisible();
  assert.ok(await page.locator('#resolution-meeting option').count() > 1, 'Resolution drafting must retain minimal source meeting choices without meeting-page access');
  await page.locator('#resolution-meeting').selectOption('m01');
  await expect(main.locator('a[href^="/meetings"]')).toHaveCount(0);
  await configurePages('user', ['changes']);
  await configurePages('executive', ['resolutions', 'reports']);
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('#team-tab-permissions').click();
  await page.locator('#permission-role').selectOption('staff');
  await expect(page.getByRole('checkbox', { name: 'Staff เข้าถึงหน้าทะเบียนมติ ไม่สามารถเปิดสิทธิ์นี้ได้', exact: true })).toBeDisabled();

  await persona('executive');
  await go('/resolutions/r03');
  await expect(main.getByRole('heading', { name: 'จัดทำแผนปรับปรุงจากผลประเมินคุณภาพ', exact: true })).toBeVisible();
  await expect(main.getByRole('button', { name: 'ตรวจเกณฑ์และรับรองปิด', exact: true })).toBeDisabled();
  await expect(main).toContainText('ยังตรวจเงื่อนไขปิดมติได้ไม่ครบตามสิทธิที่ได้รับ');
  await main.getByRole('button', { name: 'หลักฐาน', exact: true }).click();
  await expect(main.getByRole('heading', { name: 'ยังไม่มีสิทธิอ่านหลักฐานของงาน', exact: true })).toBeVisible();
  await expect(main.locator('a[href^="/tasks/"]')).toHaveCount(0);
  await go('/reports');
  await expect(main.getByRole('heading', { name: 'รายงานและผลดำเนินงาน', exact: true })).toBeVisible();
  await expect(main).not.toContainText('ไม่พบข้อมูลรายงาน');

  await persona('user');
  await go('/');
  await page.waitForURL(/\/changes$/);
  await page.getByRole('button', { name: 'สร้างคำขอ', exact: true }).click();
  assert.ok(await page.locator('#change-task option').count() > 1, 'Changes-only access must include task choices without opening task details');
  await page.locator('#change-task').selectOption('t02');
  await expect(main.locator('a[href^="/tasks/"]')).toHaveCount(0);
  await expect(page.locator('.sidebar .sidebar-nav a')).toHaveCount(1);
  await go('/meetings');
  await expect(main.getByRole('heading', { name: 'คุณไม่มีสิทธิเข้าถึงหน้านี้', exact: true })).toBeVisible();

  // Staff query parameters, search and direct links cannot expand the owned-task scope.
  await persona('staff');
  await go('/');
  await page.waitForURL(/\/tasks$/);
  await go('/tasks?scope=all');
  const ownTasks = baseline.tasks.filter(task => task.ownerId === 'u-thanaphorn');
  const foreignTasks = baseline.tasks.filter(task => task.ownerId !== 'u-thanaphorn');
  const taskHrefs = await main.locator('a[href^="/tasks/"]').evaluateAll(links => [...new Set(links.map(link => link.getAttribute('href')))].sort());
  assert.deepEqual(taskHrefs, ownTasks.map(task => `/tasks/${task.id}`).sort(), 'Staff all-scope list must remain owned tasks only');
  for (const foreign of foreignTasks) await expect(main).not.toContainText(foreign.title);
  await expect(page.locator('.sidebar a[href="/settings"]')).toHaveCount(0);
  await expect(page.locator('a[href="/reports"]')).toHaveCount(0);
  await page.getByRole('button', { name: 'ค้นหามติ งาน หรือการประชุม', exact: true }).click();
  const search = page.getByRole('dialog', { name: 'ค้นหาในพื้นที่ทำงาน', exact: true });
  await search.getByLabel('คำค้นหา', { exact: true }).fill(foreignTasks[0].title);
  await expect(search.getByRole('heading', { name: 'ยังไม่พบรายการนี้', exact: true })).toBeVisible();
  await search.getByRole('button', { name: 'ปิดหน้าต่าง', exact: true }).click();
  await go(`/tasks/${foreignTasks[0].id}`);
  await expect(main.getByRole('heading', { name: 'ไม่พบงานที่ต้องการ', exact: true })).toBeVisible();
  for (const path of ['/resolutions/r01', '/meetings', '/reviews', '/reports', '/team', '/settings']) {
    await go(path);
    await expect(main.getByRole('heading', { name: 'คุณไม่มีสิทธิเข้าถึงหน้านี้', exact: true })).toBeVisible();
  }
  await go('/changes');
  const ownIds = new Set(ownTasks.map(task => task.id));
  for (const change of baseline.changes) {
    const row = main.getByRole('row').filter({ hasText: change.code });
    if (change.requestedById === 'u-thanaphorn' && ownIds.has(change.taskId)) await expect(row).toHaveCount(1);
    else await expect(row).toHaveCount(0);
  }
  await page.getByRole('button', { name: 'สร้างคำขอ', exact: true }).click();
  await page.locator('#change-task').selectOption('t02');
  await expect(page.locator('#change-type option[value="owner"]')).toHaveCount(0);
  const afterScopeSwitches = await rawDemo();
  assert.deepEqual(afterScopeSwitches.tasks.map(task => task.id), baseline.tasks.map(task => task.id), 'Staff projection must not overwrite raw demo records');

  // Preserve async creation and assigned-review workflow under canonical roles.
  await persona('admin');
  await go('/tasks?scope=all');
  await expect(main.getByRole('link', { name: foreignTasks[0].title, exact: true })).toBeVisible();
  await go('/meetings');
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
  await configurePages('executive', ['resolutions', 'reviews', 'changes', 'team']);
  await persona('executive');
  await go('/team');
  await expect(main.getByLabel('บทบาทการเข้าถึงของ ศิริพร ใจมั่น', { exact: true })).toHaveCount(0);
  await page.locator('#team-tab-permissions').click();
  await expect(main.getByText('ดูสิทธิ์ได้ ผู้ดูแลระบบเป็นผู้แก้ไข', { exact: true })).toBeVisible();
  await expect(main.locator('#permission-role')).toHaveCount(0);
  await go('/reviews');
  await page.getByLabel('เฉพาะงานที่ฉันเป็นผู้ตรวจ').check();
  const criteria = page.locator('fieldset input[type=checkbox]');
  assert.ok(await criteria.count() > 0, 'Executive demo persona must provide a pending assigned review');
  for (const check of await criteria.all()) await check.check();
  await page.locator('#review-note').fill('ตรวจครบตามเกณฑ์จาก browser smoke test');
  const firstTitle = await page.locator('.stack .panel h2').first().textContent();
  await page.getByRole('button', { name: 'รับรองผลงาน', exact: true }).click();
  await expect(page.locator('.toast-region')).toContainText('รับรองผลงานแล้ว');
  assert.deepEqual(errors, [], 'Role policies, scoped DTOs and async workflows must not raise browser runtime errors');
  console.log(JSON.stringify({ canonicalRoles: true, zeroPageDenied: true, policyPersistence: true, staffOwnedScope: true, forbiddenRoutesDenied: true, summariesSafe: true, readOnlyExecutive: true, meetingCreatedWithAgendas: true, reloadPersisted: true, reviewAccepted: firstTitle, runtimeErrors: errors.length }));
  await page.close();
} finally { await browser.close(); }
