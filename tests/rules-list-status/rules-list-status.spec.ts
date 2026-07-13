import { test, expect } from '@playwright/test';
import { DashboardPage } from '../../pages/DashboardPage';
import { authFile, hasCreds } from '../../utils/env';

/**
 * Feature: rules-list-status — the Active/Inactive status toggle and status sort.
 * Authenticated: runs under qaAdmin, auto-skips until PyMetrikosUI access is granted.
 */

test.describe('rules-list-status', () => {
  test.skip(!hasCreds('qaAdmin'), 'qaAdmin credentials not configured');
  test.use({ storageState: authFile('qaAdmin') });

  let dashboard: DashboardPage;
  test.beforeEach(async ({ page }) => {
    dashboard = new DashboardPage(page);
    await dashboard.gotoOrSkip(test);
    await expect(dashboard.rulesTable()).toBeVisible();
  });

  test('each rule row exposes a status toggle', async () => {
    const toggles = dashboard.statusToggles();
    expect(await toggles.count()).toBeGreaterThan(0);
  });

  test('toggling a rule status flips its checked state and persists after reload', async ({ page }) => {
    const first = dashboard.statusToggles().first();
    const before = await first.isChecked();
    await first.click();
    await expect(first).toBeChecked({ checked: !before });
    await page.reload();
    await dashboard.gotoOrSkip(test);
    await expect(dashboard.statusToggles().first()).toBeChecked({ checked: !before });
    // restore original state to keep the test side-effect free
    await dashboard.statusToggles().first().click();
    await expect(dashboard.statusToggles().first()).toBeChecked({ checked: before });
  });

  test('sorting by the Status header preserves all rows and toggles order', async () => {
    const countBefore = await dashboard.ruleRows().count();
    await dashboard.header('Status').click();
    // sort must not add or drop rows
    await expect(dashboard.ruleRows()).toHaveCount(countBefore);

    if (countBefore >= 2) {
      const ascTop = await dashboard.ruleRows().first().innerText();
      await dashboard.header('Status').click(); // reverse direction
      await expect(dashboard.ruleRows()).toHaveCount(countBefore);
      const descTop = await dashboard.ruleRows().first().innerText();
      expect(ascTop).not.toBe(descTop);
    }
  });
});
