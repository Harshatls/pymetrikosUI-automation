import { test, expect, Page } from '@playwright/test';
import { LoginPage } from '../../pages/LoginPage';
import { DashboardPage } from '../../pages/DashboardPage';
import { credsFor, hasCreds, Role } from '../../utils/env';

/**
 * Feature: auth-login — Auth 2.0 login (native external-user form + Microsoft SSO entry).
 *
 * Positive SSO logins skip automatically until valid staging credentials are configured
 * (hasCreds). All negative tests run without valid credentials.
 *
 * Deliberately NOT tested: repeated wrong passwords against the real employee test
 * accounts via Microsoft SSO — Entra smart lockout could lock the shared staging users.
 * The wrong-password path is covered against the app's own (native) form instead.
 */

// Run this file's tests sequentially: parallel failed logins against the same
// endpoint look like brute force and get throttled, which flakes the error banner.
test.describe.configure({ mode: 'default' });

/** Watch for any JS dialog (alert/confirm/prompt) — none must ever fire during login. */
function failOnDialog(page: Page): () => number {
  let fired = 0;
  page.on('dialog', async (d) => {
    fired += 1;
    await d.dismiss();
  });
  return () => fired;
}

test.describe('auth-login: Microsoft SSO happy path', () => {
  const roles: Role[] = ['fullAccess', 'viewOnly', 'createAccess'];
  for (const role of roles) {
    test(`logs in via Microsoft SSO as ${role} and reaches the app`, async ({ page }) => {
      test.skip(!hasCreds(role), `No credentials configured for ${role}`);
      const { email, password } = credsFor(role);
      const loginPage = new LoginPage(page);
      await loginPage.login(email, password);
      // Back on the app host with no login form — the session is established.
      await expect(loginPage.passwordInput()).toBeHidden();
      await expect(loginPage.ssoButton()).toBeHidden();
    });
  }
});

test.describe('auth-login: native form rejects bad credentials', () => {
  let loginPage: LoginPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    await loginPage.goto();
  });

  test('rejects login for an unknown user with a generic error', async () => {
    // nativeError() matches the invalid-credential banner OR the rate-limit lockout;
    // either way the attempt is rejected and no session is granted. The generic
    // wording (no "user not found") is itself the anti-enumeration behavior we want.
    await loginPage.submitNativeCredentials('no-such-user@example.com', 'Wrong-Pass-123!');
    await expect(loginPage.nativeError()).toBeVisible();
  });

  test('rejects an employee (SSO) account on the external-users form', async () => {
    // Employee accounts must authenticate through SSO; the native form must not accept
    // them even with a syntactically fine password, and must not leak WHY it failed.
    await loginPage.submitNativeCredentials('tls.app@transformative.in', 'Whatever-123!');
    await expect(loginPage.nativeError()).toBeVisible();
  });

  test('rejects a SQL-injection payload with the same generic error', async ({ page }) => {
    await loginPage.submitNativeCredentials("attacker'--@example.com", "' OR '1'='1");
    await expect(loginPage.nativeError()).toBeVisible();
    // still on the login page, form intact
    await expect(loginPage.emailInput()).toBeVisible();
    expect(page.url()).not.toMatch(/dashboard/);
  });

  test('does not execute scripts from an XSS payload in the password field', async ({ page }) => {
    const dialogs = failOnDialog(page);
    await loginPage.submitNativeCredentials(
      'xss-probe@example.com',
      '<img src=x onerror=alert(1)><script>alert(2)</script>',
    );
    await expect(loginPage.nativeError()).toBeVisible();
    expect(dialogs(), 'no JS dialog may fire from injected markup').toBe(0);
    await expect(loginPage.emailInput()).toBeVisible();
  });

  test('handles oversized credentials without crashing', async () => {
    const bigLocal = 'a'.repeat(200);
    const bigPassword = 'P@55'.repeat(1250); // 5000 chars
    await loginPage.submitNativeCredentials(`${bigLocal}@example.com`, bigPassword);
    // Graceful rejection: generic error, form still usable — not a 5xx page or hang.
    await expect(loginPage.nativeError()).toBeVisible({ timeout: 15_000 });
    await expect(loginPage.emailInput()).toBeEditable();
  });
});

test.describe('auth-login: client-side validation blocks malformed submissions', () => {
  let loginPage: LoginPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    await loginPage.goto();
  });

  test('does not submit with empty email and password', async ({ page }) => {
    await loginPage.nativeLoginButton().click();
    // required-field validation keeps us on the login page with no server error shown
    await expect(loginPage.emailInput()).toBeVisible();
    await expect(loginPage.nativeError()).toBeHidden();
    expect(page.url()).not.toMatch(/dashboard/);
  });

  test('rejects a malformed email (missing @) server-side with the generic error', async ({ page }) => {
    // No client-side format validation exists — the server rejects it generically.
    await loginPage.emailInput().fill('not-an-email');
    await loginPage.passwordInput().fill('Some-Pass-123!');
    await loginPage.nativeLoginButton().click();
    await expect(loginPage.nativeError()).toBeVisible();
    await expect(loginPage.emailInput()).toBeVisible();
    expect(page.url()).not.toMatch(/dashboard/);
  });
});

test.describe('auth-login: brute-force protection', () => {
  test('rejects every repeated failed login and, if triggered, shows a lockout message', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    // Invariant that must always hold: no failed attempt is ever accepted.
    // Additionally, the app implements a brute-force lockout (observed live); its
    // threshold/window is non-deterministic, so we validate the lockout WORDING
    // only when it fires and annotate otherwise rather than flake on the threshold.
    let lockedOut = false;
    for (let attempt = 0; attempt < 15; attempt += 1) {
      await loginPage.submitNativeCredentials(
        `bruteforce+${attempt}@example.com`,
        'Wrong-Pass-123!',
      );
      await expect(loginPage.nativeError()).toBeVisible();
      expect(page.url()).not.toMatch(/dashboard/);
      if (await loginPage.rateLimitError().isVisible().catch(() => false)) {
        lockedOut = true;
        break;
      }
      await loginPage.emailInput().fill('');
      await loginPage.passwordInput().fill('');
    }
    if (lockedOut) {
      await expect(loginPage.rateLimitError()).toContainText(/try again in \d+ minutes?/i);
    } else {
      test.info().annotations.push({
        type: 'note',
        description: 'Rate-limit lockout not triggered within 15 attempts this run.',
      });
    }
  });
});

test.describe('auth-login: failed login grants nothing', () => {
  test('dashboard deep link still requires login after a failed attempt', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.submitNativeCredentials('no-such-user@example.com', 'Wrong-Pass-123!');
    await expect(loginPage.nativeError()).toBeVisible();

    const dashboard = new DashboardPage(page);
    await dashboard.goto();
    // bounced back to the login screen, not the rules list
    await expect(loginPage.passwordInput()).toBeVisible({ timeout: 15_000 });
    await expect(dashboard.rulesTable()).toBeHidden();
  });
});

test.describe('auth-login: password reset entry point', () => {
  test('prompts for an email before allowing change password', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.changePasswordLink().click();
    await expect(
      page.getByText(/enter your email address first/i),
    ).toBeVisible();
    expect(page.url()).not.toMatch(/reset-password/);
  });

  test('change-password with an email fires the reset request without revealing account existence', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    // nonexistent address on purpose — must not trigger a reset for a real account
    await loginPage.emailInput().fill('no-such-user@example.com');
    const [response] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/auth/reset-password'), { timeout: 15_000 }),
      loginPage.changePasswordLink().click(),
    ]);
    // 200 even for unknown accounts — the API must not leak whether the email exists
    expect(response.status()).toBe(200);
    await expect(loginPage.emailInput()).toBeVisible(); // user stays on the login page
  });
});

test.describe('auth-login: Microsoft SSO rejects unknown accounts', () => {
  test('rejects an unknown user at the Microsoft email step', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.ssoButton().click();
    await loginPage.msEmail().waitFor({ state: 'visible', timeout: 20_000 });
    await loginPage.msEmail().fill('definitely-not-a-user-2026@transformative.in');
    await page.keyboard.press('Enter');
    await expect(loginPage.msUsernameError()).toBeVisible({ timeout: 20_000 });
  });
});
