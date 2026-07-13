import { test, expect } from '@playwright/test';
import { DashboardPage } from '../../pages/DashboardPage';
import { CreateRulePage } from '../../pages/CreateRulePage';
import { authFile, hasCreds } from '../../utils/env';

/**
 * Feature: rule-actions — edit, duplicate and delete from the Options column.
 * Authenticated: runs under qaAdmin, auto-skips until PyMetrikosUI access is granted.
 * Each test creates its own uniquely-named rule and removes it, staying isolated.
 */

function uniqueName(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e4)}`;
}

test.describe('rule-actions', () => {
  test.skip(!hasCreds('qaAdmin'), 'qaAdmin credentials not configured');
  test.use({ storageState: authFile('qaAdmin') });

  let dashboard: DashboardPage;
  let form: CreateRulePage;

  /** Create a minimally-valid rule with the given name and return once it's listed. */
  async function createRule(page: import('@playwright/test').Page, name: string) {
    await form.open();
    await form.ruleNameInput().fill(name);
    await form.selectFbAccountDropdown().click();
    const firstAccount = page.locator('input[data-test^="select-account-"]').first();
    if (await firstAccount.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await firstAccount.check();
    }
    await form.selectFbAccountDropdown().click();
    await form.submitButton().click();
    await expect(dashboard.rowByName(name)).toBeVisible({ timeout: 20_000 });
  }

  async function deleteRule(page: import('@playwright/test').Page, name: string) {
    const row = dashboard.rowByName(name);
    if (!(await row.isVisible().catch(() => false))) return;
    await dashboard.rowActions(name).getByRole('button').last().click().catch(() => {});
    const confirm = page.getByRole('button', { name: /confirm|delete|yes/i });
    if (await confirm.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await confirm.click();
    }
    await expect(dashboard.rowByName(name)).toBeHidden({ timeout: 20_000 });
  }

  test.beforeEach(async ({ page }) => {
    dashboard = new DashboardPage(page);
    await dashboard.gotoOrSkip(test);
    form = new CreateRulePage(page);
  });

  test('duplicating a rule creates a copy in the list', async ({ page }) => {
    const name = uniqueName('dup-src');
    await createRule(page, name);
    // duplicate is the middle action in the Options cell
    await dashboard.rowActions(name).getByRole('button').nth(1).click();
    const confirm = page.getByRole('button', { name: /confirm|duplicate|yes|save/i });
    if (await confirm.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await confirm.click();
    }
    // a copy row referencing the source name appears (app appends a copy suffix)
    await expect(page.locator('tbody tr', { hasText: name })).toHaveCount(2, {
      timeout: 20_000,
    });

    // cleanup both
    for (const row of await page.locator('tbody tr', { hasText: name }).all()) {
      await row.locator('td').last().getByRole('button').last().click().catch(() => {});
      const c = page.getByRole('button', { name: /confirm|delete|yes/i });
      if (await c.isVisible({ timeout: 2_000 }).catch(() => false)) await c.click();
    }
  });

  test('deleting a rule removes it from the list', async ({ page }) => {
    const name = uniqueName('del');
    await createRule(page, name);
    await deleteRule(page, name);
    await expect(dashboard.rowByName(name)).toBeHidden();
  });

  test('editing a rule opens its form prefilled with the rule name', async ({ page }) => {
    const name = uniqueName('edit');
    await createRule(page, name);
    // edit is the first action in the Options cell
    await dashboard.rowActions(name).getByRole('button').first().click();
    await expect(form.ruleNameInput()).toHaveValue(name);
    await form.cancelButton().click();
    await deleteRule(page, name);
  });
});
