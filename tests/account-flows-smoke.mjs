import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';
import { localAuthServer } from './helpers/local-auth-server.mjs';
const base = process.env.AUTH_SESSION_BASE_URL || 'http://127.0.0.1:3103';
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
const auth = await localAuthServer(54329);
const browser = await chromium.launch({ channel: 'chrome', headless: true });
await mkdir('.test-artifacts/flow-visual', { recursive: true });
try {
  const context = await browser.newContext();
  await context.route('**/*.supabase.co/**', (route) => route.abort());
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const go = (path) => page.goto(base + path, { waitUntil: 'networkidle' });
  await go('/reset-password');
  await expect(page.getByRole('link', { name: 'ขอลิงก์ใหม่', exact: true })).toBeVisible();
  await expect(page.locator('#new-password')).toHaveCount(0);
  await go('/forgot-password');
  await page.getByLabel('อีเมล', { exact: true }).fill('alice@example.test');
  await page.getByRole('button', { name: 'ส่งลิงก์ตั้งรหัสผ่านใหม่', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('หากอีเมลนี้');
  const known = await page.getByRole('status').textContent();
  const recovery = auth.emailRequests.at(-1);
  assert.equal(recovery.redirectTo, base + '/auth/callback?next=/reset-password');
  await expect(page.getByRole('button', { name: /ส่งใหม่ได้ใน/ })).toBeDisabled();
  await go(`/auth/callback?code=${recovery.code}&next=/reset-password`);
  assert.equal(new URL(page.url()).origin, base);
  await expect(page.locator('#new-password')).toBeVisible();
  for (const width of [1366, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({
      path: '.test-artifacts/flow-visual/reset-form-' + width + '.png',
      fullPage: true,
    });
  }
  await page.locator('#new-password').fill('new-account-test-password');
  await page.locator('#confirm-password').fill('mismatched-test-password');
  await page.getByRole('button', { name: 'บันทึกรหัสผ่านใหม่', exact: true }).click();
  await expect(page.locator('form [role=alert]')).toContainText('ตรงกัน');
  assert.equal(auth.passwordUpdates(), 0);
  await page.locator('#confirm-password').fill('new-account-test-password');
  await page.getByRole('button', { name: 'บันทึกรหัสผ่านใหม่', exact: true }).click();
  await page.waitForURL('**/login?message=password-updated');
  await expect(page.getByRole('status')).toContainText('บันทึกรหัสผ่านใหม่แล้ว');
  assert.equal(auth.passwordUpdates(), 1);
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.locator('#login-email').fill('alice@example.test');
  await page.locator('#login-password').fill('new-account-test-password');
  await page.getByRole('button', { name: 'เข้าสู่ระบบ', exact: true }).click();
  await expect(page.locator('.topbar-avatar')).toBeVisible();
  await go('/account');
  await expect(page.getByText('บัญชี alice@example.test', { exact: true })).toBeVisible();
  for (const width of [1366, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({
      path: '.test-artifacts/flow-visual/account-form-' + width + '.png',
      fullPage: true,
    });
  }
  await page.locator('#current-password').fill('incorrect-current-password');
  await page.locator('#new-password').fill('another-account-test-password');
  await page.locator('#confirm-password').fill('another-account-test-password');
  await page.getByRole('button', { name: 'บันทึกรหัสผ่านใหม่', exact: true }).click();
  await expect(page.locator('form [role=alert]')).toContainText('รหัสผ่านปัจจุบันไม่ถูกต้อง');
  assert.equal(auth.passwordUpdates(), 1);
  await page.locator('#current-password').fill('new-account-test-password');
  await page.getByRole('button', { name: 'บันทึกรหัสผ่านใหม่', exact: true }).click();
  await page.waitForURL('**/login?message=password-updated');
  assert.equal(auth.passwordUpdates(), 2);
  await go('/forgot-password');
  await page.getByLabel('อีเมล', { exact: true }).fill('unknown@example.test');
  await page.getByRole('button', { name: 'ส่งลิงก์ตั้งรหัสผ่านใหม่', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText(known);
  await go('/verify-email');
  await page.getByLabel('อีเมล', { exact: true }).fill('alice@example.test');
  await page.getByRole('button', { name: 'ส่งอีเมลยืนยันอีกครั้ง', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('หากอีเมลนี้');
  assert.equal(auth.emailRequests.at(-1).kind, 'confirmation');
  await go('/auth/callback?code=expired-test-code&next=/reset-password');
  await expect(page.locator('#login-error')).toContainText('หมดอายุ');
  await go('/forgot-password');
  await page.getByLabel('อีเมล', { exact: true }).fill('rate@example.test');
  await page.getByRole('button', { name: 'ส่งลิงก์ตั้งรหัสผ่านใหม่', exact: true }).click();
  await expect(page.locator('form [role=alert]')).toContainText('ส่งคำขอหลายครั้ง');
  for (const width of [1366, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of [
      '/forgot-password',
      '/verify-email',
      '/reset-password',
      '/account',
      '/help',
    ]) {
      await go(path);
      await page.evaluate(() => document.fonts.ready);
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
        false,
        `${path} overflow ${width}`,
      );
      await page.screenshot({
        path: `.test-artifacts/flow-visual/${path.slice(1)}-${width}.png`,
        fullPage: true,
      });
    }
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(auth.stats.unexpected, []);
  console.log(
    JSON.stringify({
      passwordRecovery: true,
      pkceVerified: true,
      currentPasswordRequired: true,
      confirmationResend: true,
      expiredLink: true,
      noEmailEnumeration: true,
      throttle: true,
      viewports: 2,
      realEmailsSent: 0,
      runtimeErrors: 0,
    }),
  );
} finally {
  await browser.close();
  await auth.close();
}
