import { test, expect } from '@playwright/test';
import { DashboardPage } from '../../pages/DashboardPage';
import { authFile, hasCreds } from '../../utils/env';

/**
 * Feature: api-dashboard-data — the backend call that populates the rules list.
 *
 * The real endpoint lives on a backend host we can only observe from an
 * authenticated session, so this spec DISCOVERS it at runtime by watching the
 * dashboard's own XHR (no hardcoded URL), then asserts:
 *  - authenticated: it returns 200 with rule data;
 *  - unauthenticated: the same endpoint rejects the caller (401/403).
 *
 * Runs under qaAdmin and auto-skips until PyMetrikosUI access is granted.
 */

test.describe('api-dashboard-data', () => {
  test.skip(!hasCreds('qaAdmin'), 'qaAdmin credentials not configured');
  test.use({ storageState: authFile('qaAdmin') });

  const isDataCall = (url: string, resourceType: string) =>
    /rule|dashboard|pause|pymetrikos/i.test(url) &&
    (resourceType === 'fetch' || resourceType === 'xhr');

  test('dashboard data endpoint returns rule data when authenticated', async ({ page }) => {
    const dashboard = new DashboardPage(page);
    await dashboard.gotoOrSkip(test); // confirms access first (skips if not granted)
    // reload while listening so we reliably capture the backing JSON call
    const [resp] = await Promise.all([
      page.waitForResponse(
        (r) =>
          isDataCall(r.url(), r.request().resourceType()) &&
          (r.headers()['content-type'] ?? '').includes('application/json'),
        { timeout: 20_000 },
      ),
      page.reload(),
    ]);
    expect(resp.status(), `data call ${resp.url()}`).toBe(200);
    expect(await resp.json()).toBeTruthy();
  });

  test('the discovered data endpoint rejects unauthenticated callers', async ({ page, playwright }) => {
    const dashboard = new DashboardPage(page);
    await dashboard.gotoOrSkip(test);
    const [req] = await Promise.all([
      page.waitForRequest((r) => isDataCall(r.url(), r.resourceType()), { timeout: 20_000 }),
      page.reload(),
    ]);
    const endpoint = req.url();

    // fresh request context with NO cookies/session
    const anon = await playwright.request.newContext();
    const anonResp = await anon.get(endpoint, { failOnStatusCode: false });
    expect([401, 403], `anon call to ${endpoint} -> ${anonResp.status()}`).toContain(
      anonResp.status(),
    );
    await anon.dispose();
  });
});
