import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

// Uses the installed browser in an isolated headless context; no saved user profile or real login.
const baseURL = process.env.AUTH_VISUAL_BASE_URL || "http://127.0.0.1:3000";
const mode = process.env.AUTH_VISUAL_MODE || "demo";
const headings = {
  demo: "ขณะนี้อยู่ในโหมดทดลอง",
  configured: "เข้าสู่พื้นที่ทำงาน",
  missing: "รอตั้งค่าการเชื่อมต่อ",
};
assert.ok(mode in headings, "AUTH_VISUAL_MODE must be demo, configured or missing");
const artifactDirectory = resolve(".test-artifacts", "auth");
await mkdir(artifactDirectory, { recursive: true });
const browser = await chromium.launch({ channel: process.env.AUTH_BROWSER_CHANNEL || "chrome", headless: true });
try {
  for (const viewport of [{ width: 1366, height: 900 }, { width: 390, height: 844 }, { width: 360, height: 800 }]) {
    const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    const response = await page.goto(`${baseURL}/login`, { waitUntil: "networkidle" });
    assert.equal(response?.status(), 200);
    await page.evaluate(() => document.fonts.ready);
    await page.getByRole("heading", { name: headings[mode], exact: true }).waitFor({ state: "visible" });
    assert.equal(await page.locator(".sidebar").count(), 0, "Authentication pages must not render workspace navigation");
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false, "Login must not scroll horizontally");
    if (mode === "demo") {
      assert.equal(await page.getByLabel("รหัสผ่าน", { exact: true }).count(), 0);
      assert.equal(await page.getByRole("link", { name: "กลับไปทดลองใช้งาน" }).getAttribute("href"), "/");
    } else if (mode === "configured") {
      const email = page.getByLabel("อีเมล", { exact: true });
      const password = page.getByLabel("รหัสผ่าน", { exact: true });
      await email.fill("visual-test@example.invalid");
      await password.fill("visual-test-not-a-real-password");
      await page.getByRole("button", { name: "แสดงรหัสผ่าน", exact: true }).click();
      assert.equal(await password.getAttribute("type"), "text");
      await page.getByRole("button", { name: "ซ่อนรหัสผ่าน", exact: true }).click();
      assert.equal(await password.getAttribute("type"), "password");
      await email.fill("");
      await password.fill("");
      assert.equal(await page.getByRole("button", { name: "เข้าสู่ระบบ", exact: true }).isEnabled(), true);
      // Do not submit credentials or invoke a remote Auth service in a visual test.
    } else {
      assert.equal(await page.getByLabel("รหัสผ่าน", { exact: true }).count(), 0);
      await page.getByRole("heading", { name: "ตรวจค่าต่อไปนี้", exact: true }).waitFor({ state: "visible" });
    }
    const screenshot = resolve(artifactDirectory, `login-${mode}-${viewport.width}.png`);
    await page.screenshot({ path: screenshot, fullPage: true, animations: "disabled" });
    assert.deepEqual(pageErrors, [], "Login must not emit browser runtime errors");
    console.log(JSON.stringify({ mode, viewport: viewport.width, screenshot, runtimeErrors: pageErrors.length }));
    await page.close();
  }
  if (mode !== "demo") {
    const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
    await page.goto(baseURL, { waitUntil: "networkidle" });
    const expectedHeading = mode === "missing" ? "ยังเปิดพื้นที่ทำงานไม่ได้" : "เข้าสู่ระบบเพื่อใช้งานต่อ";
    await page.getByRole("heading", { name: expectedHeading, exact: true }).waitFor({ state: "visible" });
    assert.equal(await page.locator(".sidebar").count(), 0, "Connected gates must never render the demo shell");
    assert.equal(await page.locator('a[href^="/resolutions/"]').count(), 0, "Connected gates must not expose mock resolutions");
    const api = await page.request.get(`${baseURL}/api/workspace`);
    assert.equal(api.status(), mode === "missing" ? 503 : 401);
    const payload = await api.json();
    assert.equal(payload.error?.code, mode === "missing" ? "CONFIGURATION_REQUIRED" : "UNAUTHENTICATED");
    assert.equal("state" in payload, false, "Rejected requests must not return a workspace dataset");
    await page.screenshot({ path: resolve(artifactDirectory, `workspace-gate-${mode}.png`), fullPage: true });
    console.log(JSON.stringify({ mode, workspaceGate: true, apiStatus: api.status(), mockData: false }));
    await page.close();
  }
} finally { await browser.close(); }
