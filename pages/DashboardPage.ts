import { Page, expect } from '@playwright/test';
import { PYM_DASHBOARD_PATH } from '../utils/env';

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

  async goto() {
    await this.page.goto(PYM_DASHBOARD_PATH);
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
