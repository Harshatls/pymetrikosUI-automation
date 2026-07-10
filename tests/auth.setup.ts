import { test as setup } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { LoginPage } from '../pages/LoginPage';
import { authFile, credsFor, hasCreds, Role } from '../utils/env';

/**
 * Logs in once per role and caches the session as a storageState file in .auth/.
 * Feature specs opt in with: test.use({ storageState: authFile('<role>') })
 * Roles without credentials configured are skipped (their dependent specs skip too).
 */
const ROLES: Role[] = ['fullAccess', 'viewOnly', 'createAccess'];

for (const role of ROLES) {
  setup(`authenticate as ${role}`, async ({ page }) => {
    setup.skip(!hasCreds(role), `No credentials configured for ${role}`);
    const { email, password } = credsFor(role);
    const loginPage = new LoginPage(page);
    await loginPage.login(email, password);
    fs.mkdirSync(path.dirname(authFile(role)), { recursive: true });
    await page.context().storageState({ path: authFile(role) });
  });
}
