import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';
import { localAuthServer } from './helpers/local-auth-server.mjs';

// Start the app separately with the public Supabase URL http://127.0.0.1:54329,
// a fake publishable key, supabase mode, and the test organization ID.
const base = process.env.AUTH_SESSION_BASE_URL || 'http://127.0.0.1:3103';
assert.ok(
  ['localhost', '127.0.0.1'].includes(new URL(base).hostname),
  'Auth tests must only target a local app',
);
const auth = await localAuthServer(54329);
const browser = await chromium.launch({
  channel: process.env.AUTH_BROWSER_CHANNEL || 'chrome',
  headless: true,
});
try {
  const context = await browser.newContext();
  const errors = [];
  const watch = (page) => page.on('pageerror', (error) => errors.push(error.message));
  // Do not permit the browser to contact a real hosted Supabase service.
  await context.route('**/*.supabase.co/**', (route) => route.abort());
  const page = await context.newPage();
  watch(page);
  const go = (path) => page.goto(`${base}${path}`, { waitUntil: 'networkidle' });
  async function login(email = 'alice@example.test', password = 'local-test-password') {
    await page.locator('#login-email').fill(email);
    await page.locator('#login-password').fill(password);
    await page.getByRole('button', { name: 'เข้าสู่ระบบ', exact: true }).click();
  }
  const identity = (p) => p.locator('.topbar-avatar');
  await go('/login?next=%2F%2Fevil.example.test');
  await login('alice@example.test', 'incorrect-test-password');
  await expect(page.locator('#login-error')).toContainText('เข้าสู่ระบบไม่สำเร็จ');
  assert.equal(new URL(page.url()).pathname, '/login');
  await login();
  await expect(identity(page)).toHaveAttribute('title', /Alice Session/, { timeout: 20000 });
  assert.equal(new URL(page.url()).origin, new URL(base).origin);
  assert.equal(new URL(page.url()).pathname, '/');
  assert.ok(auth.stats.refreshes > 0, 'Proxy must refresh the short-lived test session');

  const other = await context.newPage();
  watch(other);
  await other.goto(`${base}/settings`, { waitUntil: 'networkidle' });
  await expect(identity(other)).toHaveAttribute('title', /Alice Session/);
  await other.locator('#reminder-days').fill('99');
  await go('/login');
  await login('bob@example.test');
  await expect(identity(page)).toHaveAttribute('title', /Bob Session/);
  await expect(identity(other)).toHaveAttribute('title', /Bob Session/);
  await expect(other.locator('#reminder-days')).not.toHaveValue('99');

  // Both tabs hide old data while the server action is still in flight.
  const releaseLogout = auth.pauseLogout();
  await page.getByRole('button', { name: 'ออกจากระบบ', exact: true }).click();
  await expect(
    other.getByRole('heading', { name: 'เข้าสู่ระบบเพื่อใช้งานต่อ', exact: true }),
  ).toBeVisible();
  await expect(other.locator('#main-content')).toHaveCount(0);
  releaseLogout();
  await page.waitForURL('**/login');
  await expect(page.locator('#login-email')).toBeVisible();
  await expect(
    other.getByRole('heading', { name: 'เข้าสู่ระบบเพื่อใช้งานต่อ', exact: true }),
  ).toBeVisible();
  const denied = await context.request.get(`${base}/api/workspace`);
  assert.equal(denied.status(), 401);
  assert.equal('state' in (await denied.json()), false);

  // Login in one tab reopens the other tab only after a verified server response.
  await login();
  await expect(identity(other)).toHaveAttribute('title', /Alice Session/);
  auth.expireSessions();
  await other.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(
    other.getByRole('heading', { name: 'เข้าสู่ระบบเพื่อใช้งานต่อ', exact: true }),
  ).toBeVisible();
  await expect(other.locator('#main-content')).toHaveCount(0);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(
    page.getByRole('heading', { name: 'เข้าสู่ระบบเพื่อใช้งานต่อ', exact: true }),
  ).toBeVisible();

  // An Auth service failure leaves a recoverable login message, not a React crash.
  await go('/login');
  await login();
  await expect(identity(page)).toHaveAttribute('title', /Alice Session/);
  auth.failLogout(true);
  await page.getByRole('button', { name: 'ออกจากระบบ', exact: true }).click();
  await page.waitForURL('**/login?error=signout');
  await expect(page.locator('#login-error')).toContainText('ออกจากระบบไม่สำเร็จ');
  assert.equal(auth.stats.writes, 0);
  assert.deepEqual(auth.stats.unexpected, []);
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      invalidLoginRejected: true,
      safeRedirect: true,
      tokenRefreshed: true,
      accountSwitchResetsForms: true,
      crossTabLogout: true,
      crossTabLogin: true,
      expiredSessionHidden: true,
      logoutFailureRecoverable: true,
      databaseWrites: 0,
      runtimeErrors: 0,
    }),
  );
} finally {
  await browser.close();
  await auth.close();
}
