# pymetrikosUI-automation

End-to-end test suite for **PyMetrikos UI** (Facebook-ads pause-rule dashboard behind
Auth 2.0 / RBAC), built with **Playwright + TypeScript** and **Allure** reporting.

Plan of record: [`docs/TEST-PLAN.md`](docs/TEST-PLAN.md) — feature list, conventions,
and the branch-per-feature git workflow.

## Prerequisites

- Node.js ≥ 18
- Java 8+ (only to generate/open Allure reports locally)
- Network access to the staging environment (`auth2.tlslogistics.org`)

## Setup

```bash
npm ci
npx playwright install chromium
cp .env.example .env   # then fill in credentials — NEVER commit .env
```

## Running tests

```bash
npm test                        # full suite, headless
npm run test:headed             # watch the browser
npx playwright test tests/scaffold.smoke.spec.ts   # single file
npx playwright test -g "expired token"             # by test name
npm run typecheck               # TypeScript check without running
```

Auth note: `tests/auth.setup.ts` runs first (Playwright project dependency), logs in
each configured role once, and caches sessions in `.auth/*.json`. Roles without
credentials in `.env` are skipped, and specs depending on them skip too.

## Reports

Every run writes `allure-results/` (plus Playwright's own `playwright-report/`).

```bash
npm run allure:generate   # allure-results -> allure-report/
npm run allure:open       # serve the generated report in a browser
```

## CI (GitHub Actions)

`.github/workflows/e2e.yml` runs on every push to `main` and every PR:

1. Installs deps + Chromium, runs the suite against staging.
2. Generates the Allure report and uploads `allure-report` + `playwright-report` artifacts.
3. Emails the run summary with the zipped Allure report attached (skipped if email
   secrets are not configured).

### Required repository secrets

| Secret | Purpose |
|---|---|
| `FULL_ACCESS_EMAIL` / `FULL_ACCESS_PASSWORD` | full-access test user |
| `VIEW_ONLY_EMAIL` / `VIEW_ONLY_PASSWORD` | view-only test user |
| `CREATE_ACCESS_EMAIL` / `CREATE_ACCESS_PASSWORD` | create-access test user |
| `EMAIL_HOST` | SMTP server hostname |
| `EMAIL_USER` / `EMAIL_PASS` | SMTP credentials |
| `EMAIL_TO` | recipient of the report email |

Optional repository **variable**: `BASE_URL` (defaults to staging).

## Project layout

```
tests/            specs (one folder per feature as they land) + auth.setup.ts
pages/            page objects (LoginPage, DashboardPage, ...)
fixtures/         shared fixtures/helpers
utils/            env/config helpers
docs/TEST-PLAN.md confirmed feature list & conventions
```
