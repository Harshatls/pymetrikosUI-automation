import { test, expect } from '@playwright/test';
import { DashboardPage } from '../../pages/DashboardPage';
import { authFile, hasCreds } from '../../utils/env';

/**
 * Feature: channel-filter — the Shopify channel dropdown that scopes the rules
 * list. Authenticated: runs under qaAdmin, auto-skips until access is granted.
 */

test.describe('channel-filter', () => {
  test.skip(!hasCreds('qaAdmin'), 'qaAdmin credentials not configured');
  test.use({ storageState: authFile('qaAdmin') });

  let dashboard: DashboardPage;
  test.beforeEach(async ({ page }) => {
    dashboard = new DashboardPage(page);
    await dashboard.gotoOrSkip(test);
  });

  test('the channel filter is present with at least one option', async () => {
    await expect(dashboard.channelDropdown()).toBeVisible();
    const options = dashboard.channelDropdown().locator('option');
    expect(await options.count()).toBeGreaterThan(0);
  });

  test('switching channel loads that channel’s rules', async ({ page }) => {
    const dropdown = dashboard.channelDropdown();
    const optionValues = await dropdown.locator('option').evaluateAll(
      (opts) => (opts as HTMLOptionElement[]).map((o) => o.value).filter(Boolean),
    );
    test.skip(optionValues.length < 2, 'account has access to only one channel');

    await expect(dashboard.rulesTable()).toBeVisible();
    const before = await dashboard.ruleRows().allInnerTexts();
    await dropdown.selectOption(optionValues[1]);
    // the list re-renders for the newly selected channel
    await expect
      .poll(async () => dashboard.ruleRows().allInnerTexts())
      .not.toEqual(before);
    await expect(dashboard.rulesTable()).toBeVisible();
  });

  test('switching channel during rule creation redirects to that channel’s dashboard', async ({ page }) => {
    const dropdown = dashboard.channelDropdown();
    const optionValues = await dropdown.locator('option').evaluateAll(
      (opts) => (opts as HTMLOptionElement[]).map((o) => o.value).filter(Boolean),
    );
    test.skip(optionValues.length < 2, 'account has access to only one channel');

    await dashboard.createRuleButton().click();
    await dropdown.selectOption(optionValues[1]);
    // redirected back to a dashboard view (not stuck on the create form)
    await expect(dashboard.rulesTable()).toBeVisible();
  });
});
