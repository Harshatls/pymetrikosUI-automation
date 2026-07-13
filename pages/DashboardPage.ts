import { Page, expect, TestType } from '@playwright/test';
import { PYM_DASHBOARD_PATH } from '../utils/env';

/**
 * Column headers of the rules list, per the live dashboard.
 * (Status, Rule Name, Max Spend/Clicks, Rule Type, Min_roi, Created At,
 *  Created by, Edited At, Last Edited by, Options)
 */
export const RULES_TABLE_HEADERS = [
  'Status',
  'Rule Name',
  'Max Spend/Clicks',
  'Rule Type',
  'Min_roi',
  'Created At',
  'Created by',
  'Edited At',
  'Last Edited by',
  'Options',
];

/** PyMetrikos UI dashboard (rules list) page. */
export class DashboardPage {
  constructor(readonly page: Page) {}

  readonly logo = () => this.page.getByText('PyMetrikos UI').first();
  readonly sidebarDashboard = () => this.page.getByText('Dashboard', { exact: true }).first();
  readonly sidebarCreateRule = () => this.page.getByText('Create a Rule').first();
  readonly searchBox = () => this.page.getByPlaceholder(/search/i).first();
  readonly goToConsoleButton = () =>
    this.page.getByRole('button', { name: /go to console/i }).first();
  readonly channelDropdown = () => this.page.locator('select, [role="combobox"]').first();
  readonly rulesTable = () => this.page.locator('table').first();
  readonly noAccessBanner = () => this.page.getByText(/you do not have access/i);
  header = (name: string) =>
    this.page.getByRole('columnheader', { name, exact: true }).first();

  async goto() {
    await this.page.goto(PYM_DASHBOARD_PATH);
  }

  /** True once the app has confirmed access is denied for the current session. */
  async isAccessDenied(): Promise<boolean> {
    return this.noAccessBanner()
      .isVisible({ timeout: 15_000 })
      .catch(() => false);
  }

  /**
   * Navigate to the dashboard and skip the calling test if this account's
   * PyMetrikosUI access has not been granted yet (shows the "Uh-oh" page).
   * Lets authenticated specs be written now and run automatically once granted.
   */
  async gotoOrSkip(test: TestType<{}, {}>) {
    await this.goto();
    if (await this.isAccessDenied()) {
      test.skip(true, 'PyMetrikosUI access not granted for this account yet (pending grant)');
    }
  }

  async expectLoaded() {
    await expect(this.logo()).toBeVisible({ timeout: 20_000 });
    await expect(this.sidebarDashboard()).toBeVisible();
  }
}

/** Protected PyMetrikos routes exercised by the protected-routes feature. */
export const PROTECTED_ROUTES = [
  '/pymetrikosui',
  '/pymetrikosui/dashboard',
  '/pymetrikosui/dashboard/1/pause-ad',
  '/pymetrikosui/dashboard/2/pause-ad',
];

/** Server-guarded API routes that must reject unauthenticated callers. */
export const PROTECTED_API_ROUTES = ['/api/auth/session', '/api/auth/user'];
