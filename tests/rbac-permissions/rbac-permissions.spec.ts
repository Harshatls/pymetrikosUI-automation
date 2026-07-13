import { test, expect } from '@playwright/test';
import { DashboardPage } from '../../pages/DashboardPage';
import { authFile, hasCreds } from '../../utils/env';

/**
 * Feature: rbac-permissions — what each role can see/do on the dashboard.
 *
 * - Full-access (qaAdmin): create/edit/delete controls are present. Runs once the
 *   qaAdmin account's PyMetrikosUI access is granted (auto-skips until then).
 * - View-only / create-access: need dedicated SSO role accounts (RBAC-158). Those
 *   specs skip until VIEW_ONLY_* / CREATE_ACCESS_* creds are configured.
 *
 * NOTE: distinguishing view-only from create requires *separate* accounts with
 * different grants. The single all-permissions qaAdmin account cannot express the
 * negative (view-only) case — hence the dedicated role gates below.
 */

test.describe('rbac-permissions: full-access account sees management controls', () => {
  test.skip(!hasCreds('qaAdmin'), 'qaAdmin credentials not configured');
  test.use({ storageState: authFile('qaAdmin') });

  let dashboard: DashboardPage;
  test.beforeEach(async ({ page }) => {
    dashboard = new DashboardPage(page);
    await dashboard.gotoOrSkip(test);
  });

  test('shows the Create a Rule control', async () => {
    await expect(dashboard.sidebarCreateRule()).toBeVisible();
    await expect(dashboard.createRuleButton()).toBeVisible();
  });

  test('shows per-row action controls and status toggles', async () => {
    await expect(dashboard.rulesTable()).toBeVisible();
    if ((await dashboard.ruleRows().count()) > 0) {
      await expect(
        dashboard.rowActions((await dashboard.ruleRows().first().innerText()).split('\n')[0])
          .getByRole('button')
          .first(),
      ).toBeVisible();
      expect(await dashboard.statusToggles().count()).toBeGreaterThan(0);
    }
  });
});

test.describe('rbac-permissions: view-only account cannot manage rules', () => {
  test.skip(!hasCreds('viewOnly'), 'viewOnly credentials not configured (needs a dedicated role account)');
  test.use({ storageState: authFile('viewOnly') });

  let dashboard: DashboardPage;
  test.beforeEach(async ({ page }) => {
    dashboard = new DashboardPage(page);
    await dashboard.gotoOrSkip(test);
  });

  test('hides the Create a Rule control', async () => {
    await expect(dashboard.createRuleButton()).toBeHidden();
  });

  test('does not expose edit/delete/duplicate row actions', async () => {
    if ((await dashboard.ruleRows().count()) > 0) {
      const first = (await dashboard.ruleRows().first().innerText()).split('\n')[0];
      await expect(dashboard.rowActions(first).getByRole('button')).toHaveCount(0);
    }
  });

  test('status toggles are read-only / disabled for view-only', async () => {
    const toggles = dashboard.statusToggles();
    if ((await toggles.count()) > 0) {
      await expect(toggles.first()).toBeDisabled();
    }
  });
});

test.describe('rbac-permissions: create-access account can create rules', () => {
  test.skip(!hasCreds('createAccess'), 'createAccess credentials not configured (needs a dedicated role account)');
  test.use({ storageState: authFile('createAccess') });

  let dashboard: DashboardPage;
  test.beforeEach(async ({ page }) => {
    dashboard = new DashboardPage(page);
    await dashboard.gotoOrSkip(test);
  });

  test('shows the Create a Rule control', async () => {
    await expect(dashboard.createRuleButton()).toBeVisible();
  });
});
