import { test, expect } from '@playwright/test';
import { DashboardPage } from '../../pages/DashboardPage';
import { authFile, hasCreds } from '../../utils/env';

/**
 * Feature: search-and-filters — searching the rules list by name and handling
 * empty results / injection strings. Authenticated: runs under qaAdmin, auto-skips
 * until PyMetrikosUI access is granted.
 */

test.describe('search-and-filters', () => {
  test.skip(!hasCreds('qaAdmin'), 'qaAdmin credentials not configured');
  test.use({ storageState: authFile('qaAdmin') });

  let dashboard: DashboardPage;
  test.beforeEach(async ({ page }) => {
    dashboard = new DashboardPage(page);
    await dashboard.gotoOrSkip(test);
    await expect(dashboard.rulesTable()).toBeVisible();
  });

  test('narrows the list to rows matching the search term', async () => {
    const firstName = (await dashboard.ruleRows().first().innerText()).split('\n')[0];
    const token = firstName.trim().split(/\s+/)[0] ?? firstName;
    await dashboard.searchBox().fill(token);
    await expect
      .poll(async () => dashboard.ruleRows().count())
      .toBeGreaterThan(0);
    // every visible row should contain the search token
    const rows = await dashboard.ruleRows().allInnerTexts();
    for (const r of rows) {
      expect(r.toLowerCase()).toContain(token.toLowerCase());
    }
  });

  test('shows an empty result set for a term that matches nothing', async () => {
    await dashboard.searchBox().fill('zzz-no-such-rule-xyz-000');
    await expect.poll(async () => dashboard.ruleRows().count()).toBe(0);
  });

  test('treats an injection string as a literal search with no matches or errors', async ({ page }) => {
    await dashboard.searchBox().fill("'; DROP TABLE rules;--");
    await page.waitForTimeout(500);
    // no crash: table chrome stays present, simply no matching rows
    await expect(dashboard.rulesTable()).toBeVisible();
    await expect.poll(async () => dashboard.ruleRows().count()).toBe(0);
  });

  test('clearing the search restores the full list', async () => {
    const total = await dashboard.ruleRows().count();
    await dashboard.searchBox().fill('zzz-no-such-rule-xyz-000');
    await expect.poll(async () => dashboard.ruleRows().count()).toBe(0);
    await dashboard.searchBox().fill('');
    await expect.poll(async () => dashboard.ruleRows().count()).toBe(total);
  });
});
