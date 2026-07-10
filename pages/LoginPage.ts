import { Page, expect } from '@playwright/test';
import { BASE_URL } from '../utils/env';

/**
 * Auth 2.0 (Centralized Access Management) login page.
 *
 * Two login paths:
 *  - "Click here to login" -> Microsoft SSO (all @transformative.in test users; no MFA)
 *  - native email/password form ("External users") — kept for negative login tests;
 *    employee accounts are always rejected by this form.
 *
 * Microsoft quirks handled (verified live against staging 2026-07-10):
 *  - the password pane animates in; filling too early gets cleared -> settle wait
 *  - fill() can be wiped by their JS -> pressSequentially + Enter
 *  - KMSI ("Stay signed in?") is detected by text, not just #idSIButton9, because
 *    that id is reused for every primary button
 */
export class LoginPage {
  constructor(readonly page: Page) {}

  // --- native ("External users") form ---
  readonly emailInput = () => this.page.locator('input[type="email"]').first();
  readonly passwordInput = () => this.page.locator('input[type="password"]').first();
  readonly nativeLoginButton = () =>
    this.page.getByRole('button', { name: /^log\s*in/i }).last();
  readonly nativeError = () => this.page.getByText(/invalid email or password/i);
  readonly changePasswordLink = () => this.page.getByText(/change password/i);

  // --- Microsoft SSO ---
  readonly ssoButton = () => this.page.getByText(/click here to login/i);
  readonly msEmail = () => this.page.locator('input[name="loginfmt"]');
  readonly msPassword = () => this.page.locator('input[name="passwd"]:visible');
  readonly msUsernameError = () => this.page.locator('#usernameError');
  readonly msPasswordError = () => this.page.locator('#passwordError');

  async goto() {
    await this.page.goto('/');
  }

  /** Primary login flow: Microsoft SSO. Throws with a clear message on bad creds. */
  async login(email: string, password: string) {
    await this.goto();
    await this.ssoButton().click();

    await this.msEmail().waitFor({ state: 'visible', timeout: 20_000 });
    await this.msEmail().fill(email);
    await this.page.keyboard.press('Enter');

    await Promise.race([
      this.msPassword().waitFor({ state: 'visible', timeout: 20_000 }),
      this.msUsernameError().waitFor({ state: 'visible', timeout: 20_000 }),
    ]);
    if (await this.msUsernameError().isVisible().catch(() => false)) {
      throw new Error(
        `Microsoft rejected account "${email}": ${await this.msUsernameError().textContent()}`,
      );
    }

    await this.page.waitForTimeout(2_000); // password pane animation settle
    await this.msPassword().click();
    await this.msPassword().pressSequentially(password, { delay: 50 });
    await this.page.keyboard.press('Enter');

    // outcome: password error, KMSI prompt, or straight redirect back to app host
    const kmsiText = this.page.getByText(/stay signed in/i);
    await Promise.race([
      this.msPasswordError().waitFor({ state: 'visible', timeout: 25_000 }),
      kmsiText.waitFor({ state: 'visible', timeout: 25_000 }),
      this.page.waitForURL((u) => u.host === new URL(BASE_URL).host, { timeout: 25_000 }),
    ]).catch(() => {});

    if (await this.msPasswordError().isVisible().catch(() => false)) {
      throw new Error(
        `Microsoft rejected password for "${email}" — update the credentials in .env / CI secrets.`,
      );
    }
    if (await kmsiText.isVisible().catch(() => false)) {
      await this.page.locator('#idSIButton9').click();
    }
    await this.waitForLoggedIn();
  }

  /** Submit the native external-user form. Used by negative auth tests. */
  async submitNativeCredentials(email: string, password: string) {
    await this.emailInput().fill(email);
    await this.passwordInput().fill(password);
    await this.nativeLoginButton().click();
  }

  async waitForLoggedIn() {
    const host = new URL(BASE_URL).host;
    await this.page.waitForURL((url) => url.host === host, { timeout: 30_000 });
    await expect(this.passwordInput()).toBeHidden({ timeout: 15_000 });
  }
}
