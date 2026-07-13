import { test, expect, Page } from '@playwright/test';
import { DashboardPage } from '../../pages/DashboardPage';
import { CreateRulePage } from '../../pages/CreateRulePage';
import { authFile, hasCreds } from '../../utils/env';

/**
 * Feature: create-rule-validation — field presence and input validation on the
 * "Create a Rule" form (mandatory fields, For-Last bounds 0..30 and -1, numeric
 * Greater-Than / ROAS, non-negative rules, injection safety, cancel).
 *
 * Authenticated: runs under qaAdmin and auto-skips until PyMetrikosUI access is
 * granted. Selectors + error strings mirror the app's data-test hooks.
 */

function failOnDialog(page: Page): () => number {
  let fired = 0;
  page.on('dialog', async (d) => {
    fired += 1;
    await d.dismiss();
  });
  return () => fired;
}

test.describe('create-rule-validation', () => {
  test.skip(!hasCreds('qaAdmin'), 'qaAdmin credentials not configured');
  test.use({ storageState: authFile('qaAdmin') });

  let dashboard: DashboardPage;
  let form: CreateRulePage;

  test.beforeEach(async ({ page }) => {
    dashboard = new DashboardPage(page);
    await dashboard.gotoOrSkip(test);
    form = new CreateRulePage(page);
    await form.open();
  });

  test('opens the create-rule form with its core fields', async () => {
    await expect(form.ruleNameInput()).toBeVisible();
    await expect(form.taskToPerformDropdown()).toBeVisible();
    await expect(form.submitButton()).toBeVisible();
    await expect(form.cancelButton()).toBeVisible();
  });

  test('accepts a typed rule name', async () => {
    await form.ruleNameInput().fill('smoke-rule-name');
    await expect(form.ruleNameInput()).toHaveValue('smoke-rule-name');
  });

  test('shows required-field errors when submitting an empty form', async () => {
    await form.submitButton().click();
    await expect(form.errors.ruleNameRequired()).toBeVisible();
    await expect(form.errors.fbAccountRequired()).toBeVisible();
  });

  test('rejects a non-numeric For-Last value', async () => {
    await form.forLastInput().fill('x');
    await form.submitButton().click();
    await expect(form.errors.forLastNotNumber()).toBeVisible();
  });

  test('rejects a For-Last value above the 30-day maximum', async () => {
    await form.forLastInput().fill('31');
    await form.submitButton().click();
    await expect(form.errors.forLastMax()).toBeVisible();
  });

  test('rejects a For-Last value below the -1 minimum', async () => {
    await form.forLastInput().fill('-5');
    await form.submitButton().click();
    await expect(form.errors.forLastMin()).toBeVisible();
  });

  test('rejects a negative Greater-Than value', async () => {
    await form.greaterThanInput().fill('-1');
    await form.submitButton().click();
    await expect(form.errors.greaterThanNegative()).toBeVisible();
  });

  test('rejects a negative ROAS (less-than) value', async () => {
    await form.roasLessThanInput().fill('-2');
    await form.submitButton().click();
    await expect(form.errors.roasNegative()).toBeVisible();
  });

  test('does not execute script injected into the rule name field', async ({ page }) => {
    const dialogs = failOnDialog(page);
    await form.ruleNameInput().fill('<img src=x onerror=alert(1)><script>alert(2)</script>');
    await form.submitButton().click();
    await page.waitForTimeout(1000);
    expect(dialogs(), 'no JS dialog may fire from injected markup').toBe(0);
    // value is kept as literal text, not interpreted as HTML
    await expect(form.ruleNameInput()).toHaveValue(/<img|<script/);
  });

  test('cancel returns to the dashboard rules list', async ({ page }) => {
    await form.cancelButton().click();
    await expect(dashboard.rulesTable()).toBeVisible();
    expect(page.url()).not.toMatch(/create/i);
  });
});
