import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';
import { localAuthServer } from './helpers/local-auth-server.mjs';
const base = process.env.AUTH_SESSION_BASE_URL || 'http://127.0.0.1:3103';
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
const auth = await localAuthServer(54329);
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const context = await browser.newContext();
  await context.route('**/*.supabase.co/**', (r) => r.abort());
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  async function signup(email) {
    await page.goto(base + '/signup', { waitUntil: 'networkidle' });
    await page.locator('#signup-email').fill(email);
    await page.locator('#signup-password').fill('local-signup-password');
    await page.locator('#signup-confirmation').fill('local-signup-password');
    await page.getByRole('button', { name: 'สมัครบัญชี', exact: true }).click();
  }
  auth.signupWithSession(false);
  await signup('awaiting@example.test');
  await expect(page.getByRole('status')).toContainText('ยังไม่ได้รับเซสชัน');
  assert.equal(auth.stats.signOuts, 0);
  auth.signupWithSession(true);
  await signup('new@example.test');
  await expect(page.locator('#main-content')).toBeVisible();
  assert.equal(auth.stats.signOuts, 0, 'Signup must preserve its authenticated session');
  assert.equal(auth.emailRequests.length, 0);
  await page.goto(base + '/signup', { waitUntil: 'networkidle' });
  await signup('new@example.test');
  await expect(page.locator('form [role=alert]')).toBeVisible();
  auth.allowWorkspace(false);
  const access = await page.request.get(base + '/api/workspace');
  assert.equal(access.status(), 403);
  assert.equal((await access.json()).error.code, 'NO_MEMBERSHIP');
  await page.goto(base + '/', { waitUntil: 'networkidle' });
  await expect(page.locator('main')).toContainText('บัญชีนี้ยังไม่ได้รับสิทธิ์');
  await expect(page.locator('a[href="/verify-email"]')).toHaveCount(0);
  auth.setClaimResponse({ claimed: 0, emailVerified: false });
  const legacy = await page.request.get(base + '/api/workspace');
  assert.equal(legacy.status(), 503);
  assert.equal((await legacy.json()).error.code, 'SCHEMA_NOT_READY');
  assert.deepEqual(errors, []);
  assert.deepEqual(auth.stats.unexpected, []);
  console.log(
    JSON.stringify({
      signupSessionRetained: true,
      noConfirmationStep: true,
      noReservationDenied: true,
      legacyUpgradeRequired: true,
      noEmailsSent: true,
      runtimeErrors: 0,
    }),
  );
} finally {
  await browser.close();
  await auth.close();
}
