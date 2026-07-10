import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { DashboardPage } from '../pages/DashboardPage';
import { authFile, hasCreds } from '../utils/env';

/**
 * Scaffold smoke checks — prove the harness, auth fixture and Allure wiring work.
 * Real feature coverage lands in the feature/* branches.
 */
test.describe('scaffold smoke: login page', () => {
  test('renders email, password and login controls', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await expect(loginPage.emailInput()).toBeVisible();
    await expect(loginPage.passwordInput()).toBeVisible();
    await expect(loginPage.nativeLoginButton()).toBeVisible();
    await expect(loginPage.ssoButton()).toBeVisible();
  });
});

test.describe('scaffold smoke: authenticated session', () => {
  test.skip(!hasCreds('fullAccess'), 'fullAccess credentials not configured');
  test.use({ storageState: authFile('fullAccess') });

  test('cached fullAccess session reaches PyMetrikos dashboard', async ({ page }) => {
    const dashboard = new DashboardPage(page);
    await dashboard.goto();
    await dashboard.expectLoaded();
  });
});
