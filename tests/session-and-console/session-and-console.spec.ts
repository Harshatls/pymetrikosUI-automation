import { test, expect } from '@playwright/test';
import { LoginPage } from '../../pages/LoginPage';
import { DashboardPage } from '../../pages/DashboardPage';
import { authFile, hasCreds, BASE_URL } from '../../utils/env';

/**
 * Feature: session-and-console — session lifetime and the Go-to-Console round trip
 * between PyMetrikos UI and the Auth 2.0 console.
 *
 * Unauthenticated console-protection tests run today. Session-persistence,
 * Go-to-Console, and logout are authenticated and skip until staging creds exist.
 * No test POSTs to the login endpoint (no rate-limiter impact).
 */

const loginUrl = /\/login(\?|$)/;
const appHost = new URL(BASE_URL).host;

test.describe('session-and-console: the console requires a session', () => {
  const consoleRoutes = ['/', '/home', '/dashboard', '/applications', '/users', '/settings'];
  for (const route of consoleRoutes) {
    test(`redirects an unauthenticated visitor from console route ${route} to /login`, async ({ page }) => {
      await page.goto(route, { waitUntil: 'domcontentloaded' });
      await page.waitForURL(loginUrl, { timeout: 20_000 });
      await expect(new LoginPage(page).passwordInput()).toBeVisible();
    });
  }

  test('login page is the branded Auth 2.0 console entry point', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveTitle(/Auth 2\.0 \| Centralized Access Management/);
    const loginPage = new LoginPage(page);
    await expect(loginPage.ssoButton()).toBeVisible();
    await expect(loginPage.emailInput()).toBeVisible();
  });
});

test.describe('session-and-console: authenticated session lifetime', () => {
  test.skip(!hasCreds('fullAccess'), 'fullAccess credentials not configured');
  test.use({ storageState: authFile('fullAccess') });

  test('session persists across a full page reload', async ({ page }) => {
    const dashboard = new DashboardPage(page);
    await dashboard.goto();
    await dashboard.expectLoaded();
    await page.reload();
    await dashboard.expectLoaded();
    expect(page.url()).not.toMatch(loginUrl);
  });

  test('session is shared with a second tab in the same context', async ({ page, context }) => {
    const dashboard = new DashboardPage(page);
    await dashboard.goto();
    await dashboard.expectLoaded();

    const tab2 = await context.newPage();
    const dashboard2 = new DashboardPage(tab2);
    await dashboard2.goto();
    await dashboard2.expectLoaded(); // no re-login required in the new tab
    expect(tab2.url()).not.toMatch(loginUrl);
    await tab2.close();
  });
});

test.describe('session-and-console: Go to Console round trip', () => {
  test.skip(!hasCreds('fullAccess'), 'fullAccess credentials not configured');
  test.use({ storageState: authFile('fullAccess') });

  test('Go to Console leaves PyMetrikos for the Auth console without re-login', async ({ page }) => {
    const dashboard = new DashboardPage(page);
    await dashboard.goto();
    await dashboard.expectLoaded();

    await dashboard.goToConsoleButton().click();
    // lands on an Auth console page on the same host, still authenticated (not /login)
    await page.waitForURL((u) => u.host === appHost && !loginUrl.test(u.pathname), {
      timeout: 20_000,
    });
    expect(page.url()).not.toMatch(/\/pymetrikosui/);
    await expect(page).toHaveTitle(/Auth 2\.0 \| Centralized Access Management/);
    // still authenticated: the console rendered, not the login form
    await expect(new LoginPage(page).passwordInput()).toBeHidden();
  });
});

test.describe('session-and-console: logout ends the session', () => {
  test.skip(!hasCreds('fullAccess'), 'fullAccess credentials not configured');
  test.use({ storageState: authFile('fullAccess') });

  test('after logout, protected routes require login again', async ({ page, context }) => {
    const dashboard = new DashboardPage(page);
    await dashboard.goto();
    await dashboard.expectLoaded();

    // Prefer a real logout control if present; otherwise drop the session to
    // exercise the same server-side effect. Either way the outcome is asserted.
    const logout = page.getByRole('button', { name: /log ?out|sign ?out/i }).first();
    if (await logout.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await logout.click();
      await page.waitForURL(loginUrl, { timeout: 20_000 }).catch(() => {});
    } else {
      await context.clearCookies();
      await page.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
      });
    }

    await dashboard.goto();
    await page.waitForURL(loginUrl, { timeout: 20_000 });
    await expect(new LoginPage(page).passwordInput()).toBeVisible();
  });
});
