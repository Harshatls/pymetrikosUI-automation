import { test, expect } from '@playwright/test';
import { LoginPage } from '../../pages/LoginPage';
import {
  DashboardPage,
  PROTECTED_ROUTES,
  PROTECTED_API_ROUTES,
} from '../../pages/DashboardPage';
import { authFile, hasCreds } from '../../utils/env';

/**
 * Feature: protected-routes — access control on PyMetrikos UI pages and APIs.
 *
 * Most tests need NO credentials: they assert that unauthenticated / missing /
 * tampered sessions are denied. The two authenticated cases (session persists,
 * post-logout access denied) skip until staging credentials are configured.
 *
 * These tests never POST to the login endpoint, so they do not touch the
 * shared-IP login rate limiter.
 */

const loginUrl = /\/login(\?|$)/;

test.describe('protected-routes: unauthenticated access is redirected to login', () => {
  for (const route of PROTECTED_ROUTES) {
    test(`redirects an unauthenticated visitor from ${route} to /login`, async ({ page }) => {
      await page.goto(route, { waitUntil: 'domcontentloaded' });
      await page.waitForURL(loginUrl, { timeout: 20_000 });
      const loginPage = new LoginPage(page);
      await expect(loginPage.passwordInput()).toBeVisible();
      // the rules list must never render for an unauthenticated user
      await expect(new DashboardPage(page).rulesTable()).toBeHidden();
    });
  }
});

test.describe('protected-routes: broken sessions are rejected', () => {
  test('redirects to login when a forged session cookie is present', async ({ page, context }) => {
    await context.addCookies([
      { name: 'token', value: 'forged.jwt.value', domain: 'auth2.tlslogistics.org', path: '/' },
      { name: 'session', value: 'not-a-real-session', domain: 'auth2.tlslogistics.org', path: '/' },
    ]);
    await page.goto('/pymetrikosui/dashboard/1/pause-ad', { waitUntil: 'domcontentloaded' });
    await page.waitForURL(loginUrl, { timeout: 20_000 });
    await expect(new LoginPage(page).passwordInput()).toBeVisible();
  });

  test('redirects to login when a tampered JWT-shaped cookie is present', async ({ page, context }) => {
    // realistic-looking but unsigned/garbage JWT — must not be accepted
    const fakeJwt =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' +
      'eyJzdWIiOiJhdHRhY2tlciIsInJvbGUiOiJhZG1pbiJ9.' +
      'tampered_signature_value';
    await context.addCookies([
      { name: 'token', value: fakeJwt, domain: 'auth2.tlslogistics.org', path: '/' },
    ]);
    await page.goto('/pymetrikosui/dashboard/1/pause-ad', { waitUntil: 'domcontentloaded' });
    await page.waitForURL(loginUrl, { timeout: 20_000 });
    await expect(new LoginPage(page).passwordInput()).toBeVisible();
  });

  test('redirects to login when storage and cookies are empty (missing session)', async ({ page, context }) => {
    await context.clearCookies();
    await page.goto('/pymetrikosui/dashboard/1/pause-ad', { waitUntil: 'domcontentloaded' });
    await page.waitForURL(loginUrl, { timeout: 20_000 });
    await expect(new LoginPage(page).passwordInput()).toBeVisible();
  });
});

test.describe('protected-routes: server APIs reject unauthenticated callers', () => {
  for (const api of PROTECTED_API_ROUTES) {
    test(`returns 401 for ${api} without credentials`, async ({ request }) => {
      const res = await request.get(api, { failOnStatusCode: false });
      expect(res.status()).toBe(401);
      const body = await res.json();
      expect(body).toHaveProperty('error');
      expect(body.error).toMatch(/unauthorized/i);
    });

    test(`returns 401 for ${api} with a forged bearer token`, async ({ request }) => {
      const res = await request.get(api, {
        failOnStatusCode: false,
        headers: { Authorization: 'Bearer forged.jwt.value' },
      });
      expect(res.status()).toBe(401);
    });
  }
});

test.describe('protected-routes: authenticated session reaches the app', () => {
  test.skip(!hasCreds('fullAccess'), 'fullAccess credentials not configured');
  test.use({ storageState: authFile('fullAccess') });

  test('a valid session loads the dashboard and survives a reload', async ({ page }) => {
    const dashboard = new DashboardPage(page);
    await dashboard.goto();
    await dashboard.expectLoaded();
    await page.reload();
    await dashboard.expectLoaded(); // session persisted, not bounced to login
    expect(page.url()).not.toMatch(loginUrl);
  });
});

test.describe('protected-routes: access is revoked after logout', () => {
  test.skip(!hasCreds('fullAccess'), 'fullAccess credentials not configured');
  test.use({ storageState: authFile('fullAccess') });

  test('dashboard deep link redirects to login once the session is cleared', async ({ page, context }) => {
    const dashboard = new DashboardPage(page);
    await dashboard.goto();
    await dashboard.expectLoaded();

    // simulate logout by dropping the session, then re-request the protected route
    await context.clearCookies();
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await dashboard.goto();
    await page.waitForURL(loginUrl, { timeout: 20_000 });
    await expect(new LoginPage(page).passwordInput()).toBeVisible();
  });
});
