import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';
import { initialState, users } from '../src/demo/fixtures/workspace.ts';
import { DEFAULT_ROLE_PAGES } from '../src/lib/access-control.ts';

// The app uses its Supabase adapter, but every workspace response is intercepted.
// No real account, password, database write, or remote Auth session is used.
const base = process.env.CONNECTED_SMOKE_BASE_URL || 'http://127.0.0.1:3102';
const browser = await chromium.launch({
  channel: process.env.AUTH_BROWSER_CHANNEL || 'chrome',
  headless: true,
});
const payload = {
  state: { ...initialState, settings: { ...initialState.settings, reminderDays: [14, 7] } },
  users,
  eligibleOwners: [],
  units: ['Test'],
  organization: { id: '11111111-1111-4111-8111-111111111111', name: 'Connected contract test' },
  permissions: ['policy.manage'],
  roles: ['secretary'],
  features: { personnelManagement: true },
  access: {
    role: 'admin',
    pages: DEFAULT_ROLE_PAGES.admin,
    policies: DEFAULT_ROLE_PAGES,
    policyVersion: 1,
    members: { [initialState.currentUserId]: { role: 'admin', version: 0 } },
  },
};
try {
  const context = await browser.newContext();
  await context.route('**/*.supabase.co/**', (route) => route.abort());
  await context.addInitScript(() => {
    window.demoStorageTouches = [];
    for (const method of ['getItem', 'setItem', 'removeItem']) {
      const original = Storage.prototype[method];
      Storage.prototype[method] = function (key, ...args) {
        if (key.startsWith('polubu-ui-demo')) window.demoStorageTouches.push({ method, key });
        return original.call(this, key, ...args);
      };
    }
  });
  const page = await context.newPage();
  const runtimeErrors = [];
  const scripts = [];
  page.on('pageerror', (error) => runtimeErrors.push(error.message));
  page.on('response', (response) => {
    if (response.url().split('?')[0].endsWith('.js')) scripts.push(response.text());
  });
  let response = { status: 200, body: payload };
  const writes = [];
  await page.route('**/api/workspace**', (route) => {
    if (route.request().method() === 'POST') {
      writes.push(route.request().postDataJSON());
      return route.fulfill({ status: 200, json: { id: '22222222-2222-4222-8222-222222222222' } });
    }
    return route.fulfill({ status: response.status, json: response.body });
  });
  await page.goto(`${base}/settings`, { waitUntil: 'networkidle' });
  await expect(page.locator('#main-content')).toBeVisible();
  await expect(page.getByLabel('มุมมองบทบาททดลอง')).toHaveCount(0);
  // Connected settings come from the API; demo reset controls stay unavailable.
  await expect(page.getByRole('button', { name: 'คืนค่าตั้งต้น', exact: true })).toHaveCount(0);
  await expect(page.locator('#reminder-days')).toHaveValue('14, 7');
  await page.locator('#reminder-days').fill('7, 3, 1');
  await page.getByRole('button', { name: 'บันทึกการตั้งค่า', exact: true }).click();
  await expect.poll(() => writes.length).toBe(1);
  assert.equal(writes[0].operation, 'update_settings');
  assert.deepEqual(writes[0].payload.patch.reminderDays, [7, 3, 1]);
  // Extracted screens still use the connected adapter and its server-supplied permissions.
  await page.goto(`${base}/team`, { waitUntil: 'networkidle' });
  await expect(page.locator('#add-personnel-button')).toBeVisible();
  await page.locator('#team-tab-permissions').click();
  await expect(page.locator('#permission-role')).toBeVisible();
  await page.goto(`${base}/tasks/t02`, { waitUntil: 'networkidle' });
  await expect(
    page.getByRole('heading', {
      name: payload.state.tasks.find((t) => t.id === 't02').title,
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'รายงานความก้าวหน้า', exact: true })).toHaveCount(
    0,
  );
  response = {
    status: 200,
    body: {
      ...payload,
      state: { ...payload.state, currentUserId: 'u-thanaphorn' },
      permissions: ['task.work', 'task.assign', 'resolution.close'],
      access: {
        ...payload.access,
        members: { ...payload.access.members, 'u-thanaphorn': { role: 'admin', version: 0 } },
      },
    },
  };
  await page.reload({ waitUntil: 'networkidle' });
  await expect(page.getByRole('button', { name: 'รายงานความก้าวหน้า', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'เพิ่มไฟล์', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'เพิ่มลิงก์', exact: true })).toBeEnabled();
  await page.goto(`${base}/resolutions/r01?addTask=1`, { waitUntil: 'networkidle' });
  await expect(page.locator('#task-title')).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'ตรวจเกณฑ์และรับรองปิด', exact: true }),
  ).toBeDisabled();
  assert.equal(writes.length, 1, 'Read-only checks must not submit a connected workflow command');
  for (const problem of [
    { status: 503, body: { error: { code: 'CONNECTION_FAILED' } } },
    { status: 401, body: { error: { code: 'UNAUTHENTICATED' } } },
    { status: 200, body: { ...payload, state: { ...payload.state, tasks: [null] } } },
  ]) {
    response = problem;
    await page.reload({ waitUntil: 'networkidle' });
    await expect(page.getByRole('main').getByRole('alert')).toBeVisible();
    await expect(page.locator('#main-content')).toHaveCount(0);
    await expect(page.getByLabel('มุมมองบทบาททดลอง')).toHaveCount(0);
    assert.deepEqual(await page.evaluate(() => window.demoStorageTouches), []);
  }
  const loadedCode = await Promise.all(scripts);
  assert.ok(
    loadedCode.every((code) => !code.includes('polubu-ui-demo-v1')),
    'Connected mode must not load the demo adapter chunk',
  );
  assert.deepEqual(runtimeErrors, []);
  console.log(
    JSON.stringify({
      connectedReads: true,
      connectedWrites: true,
      connectedSettings: true,
      connectedFeatureScreens: true,
      failureNeverFallsBack: true,
      demoStorageUntouched: true,
      demoChunkNotLoaded: true,
      runtimeErrors: 0,
    }),
  );
} finally {
  await browser.close();
}
