import { test, expect } from '@playwright/test';
import { DashboardPage } from '../../pages/DashboardPage';
import { CreateRulePage } from '../../pages/CreateRulePage';
import { authFile, hasCreds } from '../../utils/env';

/**
 * Feature: create-rule-flow — the happy-path of creating a rule and seeing it in
 * the correct channel's list, plus keyword and filter-string editing.
 *
 * Authenticated: runs under qaAdmin, auto-skips until PyMetrikosUI access is granted.
 * Each test uses a unique rule name and deletes what it creates so runs stay isolated.
 */

function uniqueName(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e4)}`;
}

test.describe('create-rule-flow', () => {
  test.skip(!hasCreds('qaAdmin'), 'qaAdmin credentials not configured');
  test.use({ storageState: authFile('qaAdmin') });

  let dashboard: DashboardPage;
  let form: CreateRulePage;

  test.beforeEach(async ({ page }) => {
    dashboard = new DashboardPage(page);
    await dashboard.gotoOrSkip(test);
    form = new CreateRulePage(page);
  });

  test('include and exclude keyword fields accept Campaign/Adset/Ad values', async () => {
    await form.open();
    await form.includeCampaign().fill('inc-campaign');
    await form.includeAdset().fill('inc-adset');
    await form.includeAd().fill('inc-ad');
    await form.excludeCampaign().fill('exc-campaign');
    await form.excludeAdset().fill('exc-adset');
    await form.excludeAd().fill('exc-ad');
    await expect(form.includeCampaign()).toHaveValue('inc-campaign');
    await expect(form.excludeAd()).toHaveValue('exc-ad');
  });

  test('add and remove filter string sections', async () => {
    await form.open();
    await form.addFilterStringButton().click();
    await expect(form.secondFilterString()).toBeVisible();
    await form.removeFilterStringButton().click();
    await expect(form.secondFilterString()).toBeHidden();
  });

  test('creates a rule and shows it in the rules list, then cleans up', async ({ page }) => {
    const name = uniqueName('e2e-rule');
    await form.open();
    await form.ruleNameInput().fill(name);

    // select the first available FB account
    await form.selectFbAccountDropdown().click();
    const firstAccount = page.locator('input[data-test^="select-account-"]').first();
    if (await firstAccount.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await firstAccount.check();
    }
    await form.selectFbAccountDropdown().click(); // close dropdown

    await form.submitButton().click();

    // the new rule appears in the list
    await expect(dashboard.rowByName(name)).toBeVisible({ timeout: 20_000 });

    // cleanup: remove the rule we created (best-effort)
    const del = dashboard
      .rowActions(name)
      .getByRole('button')
      .last();
    await del.click().catch(() => {});
    const confirm = page.getByRole('button', { name: /confirm|delete|yes/i });
    if (await confirm.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await confirm.click();
    }
  });
});
