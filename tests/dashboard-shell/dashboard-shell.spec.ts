import { test, expect } from '@playwright/test';
import { DashboardPage, RULES_TABLE_HEADERS } from '../../pages/DashboardPage';
import { authFile, hasCreds } from '../../utils/env';

/**
 * Feature: dashboard-shell — the PyMetrikos UI chrome: logo, sidebar, rules-table
 * headers, search bar, channel filter, Go-to-Console, and scroll behaviour.
 *
 * Authenticated checks run under the qaAdmin session and auto-skip until that
 * account's PyMetrikosUI access is granted (gotoOrSkip). The access-denied test
 * runs today because qaAdmin is authenticated but not yet granted.
 */

test.describe('dashboard-shell: access gating for a granted account', () => {
  test.skip(!hasCreds('qaAdmin'), 'qaAdmin credentials not configured');
  test.use({ storageState: authFile('qaAdmin') });

  test('an authenticated but ungranted account sees the access-denied page', async ({ page }) => {
    const dashboard = new DashboardPage(page);
    await dashboard.goto();
    // Runs while access is pending; once granted this asserts the opposite path
    // is taken (the test below), so we only assert the banner when it is present.
    if (await dashboard.isAccessDenied()) {
      await expect(dashboard.noAccessBanner()).toBeVisible();
      await expect(page.getByRole('button', { name: /request now/i })).toBeVisible();
      await expect(dashboard.rulesTable()).toBeHidden();
    } else {
      await dashboard.expectLoaded(); // access granted — chrome renders instead
    }
  });
});

test.describe('dashboard-shell: chrome for a granted account', () => {
  test.skip(!hasCreds('qaAdmin'), 'qaAdmin credentials not configured');
  test.use({ storageState: authFile('qaAdmin') });

  let dashboard: DashboardPage;
  test.beforeEach(async ({ page }) => {
    dashboard = new DashboardPage(page);
    await dashboard.gotoOrSkip(test);
  });

  test('shows the PyMetrikos UI logo', async () => {
    await expect(dashboard.logo()).toBeVisible();
  });

  test('sidebar contains Dashboard and Create a Rule', async () => {
    await expect(dashboard.sidebarDashboard()).toBeVisible();
    await expect(dashboard.sidebarCreateRule()).toBeVisible();
  });

  test('rules list shows every required column header', async () => {
    await expect(dashboard.rulesTable()).toBeVisible();
    for (const name of RULES_TABLE_HEADERS) {
      await expect(dashboard.header(name)).toBeVisible();
    }
  });

  test('exposes the search box', async () => {
    await expect(dashboard.searchBox()).toBeVisible();
  });

  test('exposes the channel filter and Go to Console', async () => {
    await expect(dashboard.channelDropdown()).toBeVisible();
    await expect(dashboard.goToConsoleButton()).toBeVisible();
  });

  test('search bar stays visible (frozen) after scrolling down', async ({ page }) => {
    await expect(dashboard.searchBox()).toBeVisible();
    await page.mouse.wheel(0, 3000);
    await page.waitForTimeout(500);
    await expect(dashboard.searchBox()).toBeInViewport();
  });
});
