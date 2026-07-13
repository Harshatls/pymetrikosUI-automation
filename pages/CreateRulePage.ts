import { Page } from '@playwright/test';

/**
 * PyMetrikos "Create a Rule" form. Locators use the app's own data-test hooks
 * (mirrored from the legacy behave suite) so they track the real markup.
 */
export class CreateRulePage {
  constructor(readonly page: Page) {}

  // form fields
  readonly ruleNameInput = () => this.page.locator('input[data-test="rule_name"]');
  readonly taskToPerformDropdown = () =>
    this.page.locator('select.ml-4.select.select-bordered').first();
  readonly addConditionButton = () =>
    this.page.locator('button[data-test="add_condition_button"]');
  readonly forLastInput = () =>
    this.page.locator('input.ml-2.input.input-bordered.w-24').first();
  readonly greaterThanInput = () =>
    this.page.locator('input[data-test="greater_than_0"]');
  readonly roasLessThanInput = () => this.page.locator('input[data-test="roi_0"]');

  // include / exclude keywords
  readonly includeCampaign = () =>
    this.page.locator('input[name="Include_keywords_campaign"]');
  readonly includeAdset = () => this.page.locator('input[name="Include_keywords_adset"]');
  readonly includeAd = () => this.page.locator('input[name="Include_keywords_ad"]');
  readonly excludeCampaign = () =>
    this.page.locator('input[name="Exclude_keywords_campaign"]');
  readonly excludeAdset = () => this.page.locator('input[name="Exclude_keywords_adset"]');
  readonly excludeAd = () => this.page.locator('input[name="Exclude_keywords_ad"]');

  // filter strings
  readonly addFilterStringButton = () =>
    this.page.locator('button[data-test="filter_string_add_button"]');
  readonly removeFilterStringButton = () =>
    this.page.locator('button[type="button"]', { hasText: /^X$/ }).first();
  readonly secondFilterString = () =>
    this.page.getByText(/Filter String 2:/i);

  // fb accounts
  readonly selectFbAccountDropdown = () =>
    this.page.locator('div[data-test="select-dropdown"]');

  // actions
  readonly submitButton = () => this.page.locator('button[data-test="submit_rule_button"]');
  readonly cancelButton = () => this.page.getByRole('button', { name: /^Cancel$/ });

  // validation error messages (exact text as rendered by the app)
  readonly errors = {
    ruleNameRequired: () => this.page.getByText('Rule Name is required'),
    fbAccountRequired: () => this.page.getByText('Please select atleast one fb account'),
    forLastNotNumber: () => this.page.getByText('Last days must be a number'),
    forLastMax: () => this.page.getByText('Maximum value is 30'),
    forLastMin: () => this.page.getByText('Cannot go beyond -1'),
    greaterThanNotNumber: () =>
      this.page.getByText('Greater Than Value must be a number'),
    greaterThanNegative: () =>
      this.page.getByText('Greater Than Value cannot be negative'),
    roasNotNumber: () => this.page.getByText('Roas value must be a number'),
    roasNegative: () => this.page.getByText('ROAS Value cannot be negative'),
  };

  async open() {
    await this.page.locator('[data-test="create-rule-button"]').first().click();
  }
}
