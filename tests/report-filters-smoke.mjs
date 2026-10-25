import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';
import { initialState, DEMO_TODAY } from '../src/demo/fixtures/workspace.ts';
import { legacyReportModel } from './helpers/legacy-report-model.mjs';
import { selectReportModel } from '../src/lib/workspace-selectors.ts';

const base = process.env.WORKSPACE_SMOKE_BASE_URL || 'http://127.0.0.1:3101';
const browser = await chromium.launch({
  channel: process.env.AUTH_BROWSER_CHANNEL || 'chrome',
  headless: true,
});
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${base}/resolutions?status=closed`, { waitUntil: 'networkidle' });
  await expect(page.getByLabel('สถานะมติ', { exact: true })).toHaveValue('closed');
  await expect(page.locator('.data-table tbody tr')).toHaveCount(
    initialState.resolutions.filter((r) => r.status === 'closed').length,
  );
  await page.getByLabel('สถานะมติ', { exact: true }).selectOption('all');
  await page.getByRole('button', { name: 'หน้าถัดไป', exact: true }).click();
  await expect(page.locator('.table-footer')).toContainText('หน้า 2');
  await page.getByLabel('สถานะมติ', { exact: true }).selectOption('closed');
  await expect(page.locator('.table-footer')).toContainText('หน้า 1');
  await page.goto(base, { waitUntil: 'networkidle' });
  // Actual client navigation must carry the URL status into the route's initial props.
  await page.locator('a[href="/resolutions?status=active"]').first().click();
  await expect(page.getByLabel('สถานะมติ', { exact: true })).toHaveValue('active');
  await page.goto(`${base}/reports`, { waitUntil: 'networkidle' });
  const cases = [
    { unit: 'all', meetingId: 'all' },
    { unit: initialState.tasks[0].unit, meetingId: 'all' },
    { unit: 'all', meetingId: initialState.resolutions[0].meetingId },
    { unit: initialState.tasks[0].unit, meetingId: initialState.resolutions[0].meetingId },
  ];
  for (const filters of cases) {
    const expected = legacyReportModel(initialState, { ...filters, today: DEMO_TODAY });
    const actual = selectReportModel(initialState, { ...filters, today: DEMO_TODAY });
    for (const key of Object.keys(expected)) assert.deepEqual(actual[key], expected[key]);
    await page.getByLabel('หน่วยงานในรายงาน', { exact: true }).selectOption(filters.unit);
    await page
      .getByLabel('การประชุมต้นทางในรายงาน', { exact: true })
      .selectOption(filters.meetingId);
    for (const [tab, rows, isUnits] of [
      ['สรุปรายหน่วยงาน', expected.unitRows, true],
      ['งานตามมติทั้งหมด', expected.tasks, false],
      [`งานเกินกำหนด (${expected.overdue.length})`, expected.overdue, false],
    ]) {
      await page.getByRole('tab', { name: tab, exact: true }).click();
      await expect(page.locator('.data-table tbody tr')).toHaveCount(rows.length);
      const downloaded = page.waitForEvent('download');
      await page.getByRole('button', { name: 'ส่งออก CSV', exact: true }).click();
      const file = await downloaded;
      const csv = await readFile(await file.path(), 'utf8');
      for (const row of rows) {
        if (isUnits)
          assert.ok(
            csv.includes(
              [row.name, row.total, row.active, row.waiting, row.overdue, row.accepted]
                .map((value) => `"${value}"`)
                .join(','),
            ),
          );
        else assert.ok(csv.includes(`"${row.code}"`));
      }
      if (!isUnits)
        for (const task of initialState.tasks.filter(
          (task) => !rows.some((row) => row.id === task.id),
        ))
          assert.ok(!csv.includes(`"${task.code}"`));
    }
  }
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      resolutionUrlFilters: true,
      paginationReset: true,
      reportFilterCombinations: cases.length,
      csvViews: 3,
      resultsEqual: true,
      runtimeErrors: 0,
    }),
  );
} finally {
  await browser.close();
}
