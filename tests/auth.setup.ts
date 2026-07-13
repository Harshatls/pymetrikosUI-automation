import { test as setup } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { LoginPage } from '../pages/LoginPage';
import { authFile, credsFor, hasCreds, LOGIN_METHOD, Role } from '../utils/env';

/**
 * Logs in once per role and caches the session as a storageState file in .auth/.
 * Feature specs opt in with: test.use({ storageState: authFile('<role>') })
 * Roles without credentials configured are skipped (their dependent specs skip too).
 *
 * SSO roles use the Microsoft flow; native roles (e.g. the QA automation account)
 * use the external-users email/password form.
 */
const ROLES: Role[] = ['fullAccess', 'viewOnly', 'createAccess', 'qaAdmin'];

for (const role of ROLES) {
  setup(`authenticate as ${role}`, async ({ page }) => {
    setup.skip(!hasCreds(role), `No credentials configured for ${role}`);
    const { email, password } = credsFor(role);
    const loginPage = new LoginPage(page);
    if (LOGIN_METHOD[role] === 'native') {
      await loginPage.loginNative(email, password);
    } else {
      await loginPage.login(email, password);
    }
    fs.mkdirSync(path.dirname(authFile(role)), { recursive: true });
    await page.context().storageState({ path: authFile(role) });
  });
}
