# PyMetrikos UI — E2E Test Plan

Confirmed plan of record for this suite (agreed 2026-07-10). Any future session should
read this file before touching the repo.

## System under test

- **App:** PyMetrikos UI — Facebook-ads pause-rule automation dashboard.
- **Entry:** Auth 2.0 (Centralized Access Management / RBAC) at the `BASE_URL`.
- **Environments:** `auth2.tlslogistics.org` = **staging** (default target), `auth.tlslogistics.org` = **prod** (never run destructive tests there).
- **Black-box:** no app source available; tests drive the deployed UI + API only.

## Stack

Playwright + TypeScript, Allure reporting (`allure-playwright` + `allure-commandline`),
GitHub Actions CI with emailed report. Roles authenticate once in `tests/auth.setup.ts`
and are cached as storageState files under `.auth/`.

### Test users (creds in `.env` / GitHub secrets — never committed)

| Role key | Access |
|---|---|
| `fullAccess` | create/edit on all channels (tls.app) |
| `viewOnly` | view only (apptest1) |
| `createAccess` | create on subset of channels (apptest2) |

## Git workflow

One feature = one branch (`feature/<name>`) = one PR to `main`, squash-merged after
approval. Setup lives on `chore/test-suite-setup`. Every PR description lists positive
and negative scenarios; a self-review comment is posted on each PR.

## Feature list (each row = branch + PR, in order)

| # | Branch | Scope |
|---|--------|-------|
| 1 | `feature/auth-login` | Email/password login per role; wrong password, unknown user, empty/oversized/malformed inputs, injection/XSS in login fields; error messages; reset link |
| 2 | `feature/protected-routes` | Unauthenticated dashboard access redirects to login; missing/expired/tampered session; post-logout access; deep links |
| 3 | `feature/session-and-console` | Session persists across reload; Go to Console round-trip; logout |
| 4 | `feature/rbac-permissions` | viewOnly sees no create/edit/delete/toggle; createAccess sees them; channel visibility limits; server-side rejection (not just hidden UI) |
| 5 | `feature/dashboard-shell` | Sidebar, logo, table headers, user name, scroll, frozen search bar |
| 6 | `feature/channel-filter` | Channel dropdown, switching loads correct rules, only permitted channels, switch during create redirects |
| 7 | `feature/rules-list-status` | Status toggle on/off, sort by status, persistence after reload, blocked for viewOnly |
| 8 | `feature/search-and-filters` | Search by rule name; filters (status, type, created/edited by/at); empty results; combined filters; injection strings in search |
| 9 | `feature/create-rule-validation` | Field presence; mandatory errors; For-Last bounds (0–31, -1); negative ROAS rejected; non-numeric rejected; XSS/injection payloads; duplicate-name error; cancel |
| 10 | `feature/create-rule-flow` | Create rule happy paths (Ad/Adset/Campaign × Spends/Clicks); include/exclude keywords; filter strings add/remove; FB-account dropdown |
| 11 | `feature/rule-actions` | Edit, duplicate ("-copy"), delete; list reflects changes |
| 12 | `feature/api-dashboard-data` | API: pause-ad dashboard data endpoint filters (oracles captured in `~/testBhavyaPymetrikosUiData`); 401/403 on missing/tampered token; malformed params |

**Out of scope:** Microsoft SSO interactive flow (MFA — smoke-check button only), rule
*execution* against live FB spend data, Auth console admin modules (Users, Applications,
Audit Log, Insights). RBAC request→grant→escalate flow is optional future work (mutates
shared RBAC state).

## Test conventions

- Behavior-style names: `rejects login with expired token`.
- Every feature covers POSITIVE + NEGATIVE (invalid/boundary/malformed inputs, auth
  failures, unauthorized access, duplicate/out-of-order actions, 4xx/5xx handling,
  defensive injection/XSS checks) and asserts the exact error message/code.
- Tests isolated and independently runnable; no shared mutable state; any created rule
  is uniquely named (timestamp suffix) and cleaned up in teardown.
