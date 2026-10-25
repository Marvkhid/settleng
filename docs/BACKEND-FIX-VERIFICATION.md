# Backend scan — findings and fixes

Date: 2026-10-23 · Scope: `api/` (NestJS + Prisma + Supabase auth)

## Bugs found and fixed

### 1. Integration suite silently inherited the developer's `api/.env` (34 of 35 tests 401'd)

`ConfigModule.forRoot({ isGlobal: true })` loads `api/.env` into `process.env`. With `SUPABASE_URL`
set there, `SupabaseJwtService` built a JWKS verifier for the real Supabase project, so the suite's
HS256 test tokens were rejected and **every authenticated request returned 401**. The whole
integration suite (tenancy isolation, invoices, payments, reconciliation) was red.

Fix — [app.module.ts](../api/src/app.module.ts): ignore the `.env` file when `NODE_ENV === 'test'`
(Jest sets it), so tests configure themselves only through `process.env` (embedded Postgres URL +
`SUPABASE_JWT_SECRET` from `test/support/global-setup.js`).

### 2. Account deletion impossible after confirming a CSV match (409 on `DELETE /api/auth/account`)

`deleteAccount` deleted `ImportedTransaction` rows before `Transaction` rows, but
`Transaction.importedTransactionId` references `ImportedTransaction` with `onDelete: Restrict`.
Confirming a reconciliation row stores exactly such a link, so deleting the account failed with a
Prisma P2003 that the exception filter surfaced as `409 Conflict` — the business data (and the auth
user) could never be removed.

Fix — [onboarding.controller.ts](../api/src/auth/onboarding.controller.ts): delete transactions
first, then imported rows/imports, then payments, invoices, customers, audit rows, business.

Reproduced with the old order (409) and verified fixed (200) by the new integration test
`account deletion › deletes all of the account's data…`.

### 3. `ReconciliationService.getRow` read a row without tenant scoping

`findFirstOrThrow({ where: { id } })` — an id-only lookup, unlike every other read in the service.
Not exploitable today (it only runs after a scoped transaction) but a hole waiting for a refactor.

Fix — [reconciliation.service.ts](../api/src/reconciliation/reconciliation.service.ts): scope by
`import: { businessId: requireBusinessId() }`.

### 4. Production-boot check asserted a 404 that can never happen

`test/production-boot.mjs` probed `/api/customers/does-not-exist` without a token and expected
`404`; the global guard correctly answers `401` first. The check had been failing, so the deploy
smoke test never passed.

Fix — [production-boot.mjs](../api/test/production-boot.mjs): assert the 401 sign-in message for the
protected path (it must not reveal whether a record exists to a stranger) **and** a real 404 shape
through the exception filter on an unknown public path, both leak-free.

## Verification (all run after the fixes)

| Check | Command | Result |
| --- | --- | --- |
| Unit tests | `npm test` | 8 suites / 66 tests pass |
| Integration tests (real embedded Postgres, real HTTP) | `npm run test:int` | 1 suite / 35 tests pass (was 34 failing) |
| Production artifact boot, CORS, health, trusted proxy, error shape | `npm run test:prod-boot` | 11/11 checks pass (was 10/11) |
| Lint (changed files) | `npx eslint -c eslint.config.mjs …` | clean |
| Build | `npm run build` (via `test:prod-boot`) | `prisma generate` + `nest build` succeed |

## Notes / remaining gaps

- `web/public/favicon.ico` is missing (web asset, not backend) — browsers 404 on `/favicon.ico`.
- `api/.env` is not committed (expected); copy `api/.env.example` and fill in the Supabase values.
  The integration suite no longer depends on it.
- The Render deployment itself cannot be verified from this machine (no dashboard access); the
  production boot path it uses (`node dist/main`, `/api/health`, env validation) is covered above.
