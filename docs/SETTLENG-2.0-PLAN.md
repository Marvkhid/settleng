# SettleNG 2.0 — architecture audit and staged plan

**Status:** Stage 1 deliverable. Documentation only — no schema change, no auth change, no application code
change has been made. This document exists so the expansion can be approved before anything is migrated.

**Baseline verified on 1 November 2026** (see §1). Every stage below is required to keep both of those builds
green; that is a hard gate, not an aspiration (§6).

---

## 1. Verified build baseline

Run against the current `master`, nothing else modified.

| Gate | Command | Result |
|---|---|---|
| Render API build | `bash scripts/render-build.sh` (`npm ci --include=dev --workspace api` → `prisma generate` → `nest build`) | **exit 0**, `api/dist/main.js` emitted |
| Vercel web build | `cd web && npm run build` (`next build`) | **exit 0**, compiled in 11.7 s, 29/29 pages generated, 30 routes |
| Working tree | `git status --porcelain` | clean (only untracked `.cloud-attachments/`) |
| Lockfile | `git diff --stat -- package-lock.json` | unchanged |

Routes produced by the current web build: `_not-found, about, api/login-notice, api/signup-notice, apple-icon,
auth/complete, auth/confirm, customers, customers/[id], dashboard, forgot-password, icon.svg, invoices,
invoices/[id], invoices/[id]/edit, invoices/new, login, manifest, onboarding, opengraph-image, privacy,
reconciliation, reports, reset-password, robots.txt, settings, signup, sitemap.xml, support, terms,
transactions, transactions/new`.

Tests that already exist and must keep passing: 9 API unit specs, `test/int` (real throwaway Postgres),
`test/e2e`, and web vitest suites.

---

## 2. What exists today

### 2.1 Database (10 models, Prisma → `api/src/generated/prisma`)

| Model | Key facts that matter for 2.0 |
|---|---|
| `Business` | **`ownerId @unique`** — one business per user. `name`, `currency` (default `NGN`). This is the de-facto tenant root. |
| `Profile` | `userId @unique`, `fullName`. |
| `Customer` | `businessId`, `name/email/phone/notes`, `archivedAt`. Already the debtor record for invoices. |
| `Invoice` | `businessId`, `customerId`, `invoiceNumber` unique per business, `issueDate`/`dueDate` (`@db.Date`), `isDraft`, `voidedAt`. **No stored total, no stored status.** |
| `InvoiceItem` | `quantity Decimal(12,2)`, `unitPrice Decimal(14,2)`. |
| `InvoicePayment` | `amount Decimal(14,2)`, `paymentDate`, `method`, `reference`, `@@unique([invoiceId, reference])` (duplicate-receipt guard). |
| `Transaction` | `businessId`, `type INCOME/EXPENSE`, `source MANUAL/INVOICE_PAYMENT/IMPORTED`, `amount Decimal(14,2)`, `category`, `date`; `invoicePaymentId` / `importedTransactionId` unique → one ledger row per payment, enforced by the DB. |
| `ReconciliationImport` / `ImportedTransaction` | CSV statement review; a suggested match changes no money until confirmed. |
| `AuditEvent` | `businessId`, `action`, `entityType`, `entityId`, `summary`, `createdAt`. **No actor.** |

Indexes already present: `Business(ownerId)`, `Customer(businessId,name)`, `Invoice(businessId,dueDate)`,
`Invoice(customerId)`, `InvoiceItem(invoiceId)`, `InvoicePayment(invoiceId)`, `Transaction(businessId,date)`,
`Transaction(businessId,type,date)`, `Transaction(businessId,category)`, `ReconciliationImport(businessId)`,
`ImportedTransaction(importId)`, `ImportedTransaction(externalReference)`, `AuditEvent(businessId,createdAt)`.

### 2.2 API surface (NestJS, ~40 endpoints)

`health`, `health/ready`, `auth/me|bootstrap|business|account`, `customers` (list, CRUD, archive/restore,
`customers/:id/payments`), `invoices` (list, CRUD, issue, void, `invoices/:id/payments`), `payments`
(list per invoice), `transactions` (list, CRUD, categories), `reports/{dashboard, summary, timeseries,
performance, customers-owing, export}`, `reconciliation/{preview, imports, imports/:id, template,
rows/:id/confirm, rows/:id/reject}`, `audit`.

### 2.3 Tenancy and auth — the part that constrains everything

```
Supabase JWT (JWKS, jose)
  → AuthGuard (global, opt-out via @Public())
      → tenantStore (AsyncLocalStorage) filled with userId, fullName
      → business looked up by business.ownerId === userId
  → services call currentBusinessId()   // throws 401 if no business
```

Consequences worth stating plainly:

- Every query is scoped by a **business derived from the token**, never from the request body. That is the
  single most valuable property in the codebase and 2.0 must not weaken it.
- `currentBusinessId()` throws when a user has no business, so "personal account with no business" is currently
  a 401 on every data route.
- A second member of the same business is structurally impossible: access *is* ownership.

### 2.4 Frontend

App Router with a `(app)` group, client-side `AuthProvider` calling `/auth/me`, `RequireBusiness` redirecting to
`/onboarding`, `AppShell` with 6 primary nav items + 2 secondary, desktop sidebar and mobile bottom bar with a
central record action. Feature views live in `web/components/forms/*` with a single API client
(`web/lib/api-client.ts`). Money is always a string with two decimals; charts use recharts.

### 2.5 Conventions to preserve (not optional)

1. Money = `Decimal` in Postgres, decimal strings over the wire, `decimal.js` for arithmetic. Never a float.
2. Derived state is never stored: invoice status is computed from items, payments and due date on every read.
   Debt status must follow the same rule.
3. Tenant from token; ids from the body are ignored.
4. "Today" is Africa/Lagos.
5. Every list endpoint is paginated, default 20, hard max 100.
6. Save actions are single-flight in the UI; duplicate-receipt protection is a DB unique index, not UI hope.
7. Optional integrations fail silently *and truthfully* (`{sent:false, reason:"not_configured"}`) — never a fake
   success.

---

## 3. Findings and blockers, ranked by blast radius

**B1 — `Business.ownerId @unique` blocks both headline features.**
A person cannot have a personal workspace *and* a business workspace, and a business cannot have a second user.
Removing the unique constraint is data-preserving, but four code paths use `findUnique({ where: { ownerId } })`
and will throw at runtime the moment two workspaces exist. Migration and code must ship in one commit (§4).

**B2 — Tenant resolution assumes ownership.**
`AuthGuard` resolves the business by owner id; `currentBusinessId()` trusts it. Multi-user requires resolving by
**membership**, with the requesting user's active workspace validated per request.

**B3 — `AuditEvent` has no actor.**
Enterprise oversight ("who followed up this account, who recorded this payment") needs `actorUserId`,
`workspaceId` naming consistent across new tables, and an append-only policy.

**B4 — There is no scheduler, and Render's free tier cannot host one.**
Scheduled reminders need a trigger. Render cron jobs are a paid feature and free web services have no persistent
process. Plan: a protected, idempotent dispatch endpoint plus an external free scheduler (GitHub Actions cron)
holding a shared secret. Manual reminders must work without it.

**B5 — No messaging credentials exist, and delivery must not be faked.**
`RESEND_API_KEY` was unset as of the last live check (`{"sent":false,"reason":"not_configured"}`). Render's free
tier also blocks outbound SMTP ports 25/465/587, so HTTP provider APIs only. Reminder status must record the real
provider outcome, including `SKIPPED` with a reason.

**B6 — No file storage design for evidence/attachments.**
Supabase Storage is available (1 GB free) but needs a **private** bucket, server-side upload, magic-byte
validation, size cap and short-lived signed URLs. A public bucket would leak debtor evidence.

**B7 — Naming.**
`Business` is really "workspace". Renaming the table would touch ~2,300 lines of services, every query and the
whole web client for zero functional gain. Decision: **keep `Business` as the tenant root**, add `kind`, and use
"workspace" in UI copy and new API paths. Documented here so it is not re-litigated per stage.

**B8 — Small dead surface found during the audit.**
`web/lib/api-client.ts` exposes `updateProfile()` calling `PATCH /api/auth/me`, which no controller implements,
and nothing in the UI calls it. Harmless today; fold it into Stage 2 rather than leaving a client method that
404s.

**B9 — Local-only hazard in the Render build script.**
`scripts/render-build.sh` runs `npm ci --workspace api`, which deletes the root `node_modules` — correct on a
clean Render checkout, destructive on a developer machine (it removed the web app's dependencies during this
audit; restored with `npm install`, lockfile unchanged). Use `npm run build:api` locally. Not changed in this
stage.

Earlier, unrelated-but-relevant operational facts: one Render instance, 512 MB RAM / 0.1 CPU, ~60 s cold start
after 15 min idle; Supabase free 500 MB and pauses after 7 days idle; Vercel Hobby is non-commercial use only.

---

## 4. Target architecture

### 4.1 Tenancy: workspace + membership, backward compatible

1. `Business` gains `kind` (`PERSONAL` | `BUSINESS`, default `BUSINESS` — existing rows stay valid).
2. `Business.ownerId` keeps its column but **loses `@unique`** (indexed instead): one user may own a personal and
   a business workspace. `ownerId` remains the creator/owner of record.
3. New `OrganisationMembership` (`workspaceId`, `userId`, `role`, `status`, `invitedEmail`, timestamps;
   `@@unique([workspaceId, userId])`, `@@index([userId])`).
4. Migration backfills one `OWNER` membership per existing `Business` with
   `INSERT … SELECT … ON CONFLICT DO NOTHING`, so no user loses access.
5. Resolution order per request: explicit `X-Workspace-Id` header → validated against membership; otherwise the
   workspace the user owns. Old web builds therefore keep working during the rollout.
6. `GET /api/auth/me` keeps returning today's `business` object **and** adds `workspaces[]`. The existing
   `RequireBusiness` guard keeps functioning until the web app ships its switcher.

Personal vs business differences are UI + permission, not separate tables: a personal workspace simply has no
customers/invoices, and its debts use `direction` both ways.

### 4.2 Permissions

| Capability | Owner | Manager | Staff |
|---|---|---|---|
| View finance, invoices, reports | ✅ | ✅ | read-only summary |
| Record sales/expenses/payments | ✅ | ✅ | assigned debtors only |
| Create/edit debts, send reminders | ✅ | ✅ | assigned debts only |
| Staff invitations, roles, workspace settings | ✅ | ❌ | ❌ |
| Account deletion, ownership transfer | ✅ | ❌ | ❌ |

Enforced server-side by a `@Roles()`/`RolesGuard` reading the membership row — never by hiding UI.

### 4.3 New models (concrete, additive)

```
enum WorkspaceKind { PERSONAL BUSINESS }
enum MembershipRole { OWNER MANAGER STAFF }
enum MembershipStatus { INVITED ACTIVE REMOVED }
enum DebtDirection { OWED_TO_ME I_OWE }
enum DebtOverride { DISPUTED WRITTEN_OFF CANCELLED }   // null = derived status
enum ReminderChannel { EMAIL WHATSAPP SMS }
enum ReminderStatus { SCHEDULED SENDING SENT FAILED SKIPPED }
enum NotificationStatus { SENT FAILED SKIPPED }

Business.kind, OrganisationMembership, AuditEvent.actorUserId

Debt            id, workspaceId, customerId?, counterpartyName, counterpartyPhone, counterpartyEmail?,
                direction, principal Decimal(14,2), currency, description, incurredOn @db.Date,
                dueOn @db.Date?, terms?, override DebtOverride?, assignedToUserId?, createdByUserId,
                createdAt, updatedAt
                @@index([workspaceId, dueOn]) @@index([workspaceId, direction, dueOn])
                @@index([workspaceId, assignedToUserId]) @@index([customerId])

DebtRepayment   id, debtId, amount Decimal(14,2), paidOn @db.Date, method, reference?, note?,
                recordedByUserId, createdAt
                @@unique([debtId, reference]) @@index([debtId, paidOn])

PaymentRequest  id, debtId, tokenHash unique, tokenPrefix, expiresAt?, revokedAt?, createdByUserId,
                lastViewedAt?, viewCount Int @default(0)      @@index([debtId])

Reminder        id, debtId, channel, scheduledFor, status, templateKey, sentAt?, attempts Int,
                lastError?, createdByUserId          @@index([status, scheduledFor]) @@index([debtId])

NotificationLog id, reminderId?, debtId, channel, provider, providerMessageId?, status, errorCode?,
                createdAt (append-only)              @@index([debtId, createdAt])

RecoveryAssignment id, debtId, userId, assignedByUserId, createdAt, endedAt?
                @@unique([debtId, userId, endedAt]) @@index([userId])

RecoveryActivity id, debtId, actorUserId, kind, summary, createdAt   @@index([debtId, createdAt])

SupportingDocument id, workspaceId, debtId?, storageKey unique, filename, mime, sizeBytes,
                uploadedByUserId, createdAt        @@index([workspaceId]) @@index([debtId])
```

`Debt` keeps `principal` immutable after creation (corrections are an explicit adjustment record, never an
overwrite). `DebtRepayment` rows are append-only. Balance is always `principal − Σ repayments`, computed in one
shared service used by the API, the public page and reports, so the three can never disagree.

### 4.4 Money and concurrency rules

- Store `Decimal(14,2)`; validate `> 0`; compare with `decimal.js`.
- Repayment insert runs inside `$transaction` with `SELECT … FOR UPDATE` on the debt row, so two clicks cannot
  overpay. Overpayment beyond the balance is rejected unless the user explicitly records an overpayment.
- Duplicate protection mirrors `InvoicePayment`: `@@unique([debtId, reference])` plus an optional
  `idempotencyKey` from the client.

### 4.5 Public payment-request page

- Token: 32 random bytes (base64url), stored **hashed** (SHA-256), prefixed for support lookups.
- `GET /api/public/payment-requests/:token` — `@Public()`, 10 requests/min/IP, no enumeration, no error
  distinction between "unknown" and "expired".
- Returns only: creditor name, payment reference, principal, amount paid, outstanding balance, due date, payment
  instructions, dispute contact. Never phone numbers of third parties, never documents, never other debts.
- The debtor cannot mark anything paid. The creditor confirms manually; the confirmation writes an
  `AuditEvent` + `RecoveryActivity`.
- Revoking a request is a single flag; rotating it invalidates the old hash.

### 4.6 Notifications and delivery truth

Provider adapters behind one interface (`send() → {ok, providerMessageId?, errorCode?}`):

| Channel | Provider path | Notes |
|---|---|---|
| Email | Resend HTTP API (already used by the web notices) | never SMTP — blocked on Render free |
| WhatsApp | Approved BSP / Meta WhatsApp Cloud API template messages | requires approved templates + consent |
| SMS | A Nigerian-capable provider (e.g. Termii) or Twilio | sender ID registration needed |

No credentials ⇒ `status: SKIPPED`, `reason: provider_not_configured`, visible in the UI as "not sent".
Every attempt appends to `NotificationLog`; the UI shows the provider's own message id or failure code.

Dispatch: `POST /api/internal/reminders/dispatch` (`@Public()` + `x-cron-secret` constant-time compare + rate
limit), claims due reminders with `SELECT … FOR UPDATE SKIP LOCKED`, so overlapping runs cannot double-send. If
`CRON_SECRET` is unset the route 404s and only manual sends work. Templates are professional and factual — no
threats, no third-party contact.

### 4.7 Analytics

Debt ageing is SQL, not JavaScript loops: buckets `not due`, `1–30`, `31–60`, `61–90`, `>90` days overdue from
`due_on` against Lagos "today", grouped per workspace with `groupBy`. Recovered-vs-outstanding trends come from
`DebtRepayment.paidOn`. Nothing is hardcoded; every figure traces to rows.

---

## 5. Stages

Each stage ends with the same gates (§6) and a report of: what shipped, files changed, migrations, tests and
results, open issues, deployment requirements.

### Stage 2 — Account architecture
`kind` + memberships + actor on audit; tenant resolved by membership; `X-Workspace-Id`; roles guard; workspace
switcher; personal vs business onboarding; `/auth/me` additive; `updateProfile` either implemented or deleted.
**Migrations:** one additive migration (enum + column + table + backfill + drop unique index).
**Highest-risk stage** — the only one that touches authentication. Ship API first (compatible), then web.
**Tests:** owner still sees their data after migration; second member sees the same workspace; staff denied
owner actions; personal workspace cannot reach invoice routes.

### Stage 3 — Debt management
`Debt`, `DebtRepayment`, derived status, partial repayments, repayment history, debt dashboard (owed, recovered,
outstanding, overdue, due soon), search/filter/sort/date range, debtor link to existing `Customer`.
**Migrations:** two tables + indexes. No change to existing tables.
**Tests:** ₦150,000 − 30,000 − 50,000 = 70,000; concurrent double repayment rejected; overpayment rejected;
disputed debt excluded from "verified" totals; existing invoice balances unchanged.

### Stage 4 — Recovery
`PaymentRequest`, `Reminder`, `NotificationLog`, `SupportingDocument`, public page, provider adapters, dispatch
endpoint, reminder history UI, overdue tracking.
**Migrations:** four tables. Optional env vars only (`RESEND_API_KEY`, `CRON_SECRET`, provider keys) — the app
must boot and build with none of them.
**Tests:** token cannot enumerate; expired/revoked returns the same response; signed-out public GET works while
every other route stays 401; unconfigured provider reports SKIPPED; dispatch run twice sends once.

### Stage 5 — Enterprise
Invitations, membership management, assignments, follow-up schedules, recovery activity log, manager oversight
dashboards, per-officer performance.
**Migrations:** assignments/activities already created in Stage 4 where possible; otherwise additive only.
**Tests:** invited-then-removed member loses access immediately; staff sees only assigned debts; manager cannot
change roles.

### Stage 6 — Analytics and polish
Debt ageing, receivables/recovered trends, customer payment performance, profit & loss, mobile pass, empty/
loading/error states, accessibility re-audit.
**Migrations:** none expected; indexes only if a measured query needs one.

---

## 6. Non-negotiable deploy gates (every stage)

1. `bash scripts/render-build.sh` → exit 0.
2. `cd web && npm run build` → exit 0 (including the `NEXT_PUBLIC_API_URL` guard on Vercel).
3. `cd api && npm test` and `npm run test:int` → pass.
4. Migration applied with `prisma migrate deploy` to a scratch Postgres, then the built API booted
   (`node dist/main`) and `/api/health` + `/api/health/ready` return ok. Render runs migrations on boot, so a
   failing migration is a dead API, not a warning.
5. Migrations are additive and idempotent; **no column dropped, renamed or narrowed**, no destructive change to
   existing financial rows.
6. No new required environment variable, no new native dependency, no second lockfile, no new hosting provider.
7. Existing flows re-verified on a throwaway account: sign up → bootstrap → dashboard → record a sale → reload →
   sign out → sign in → delete account.
8. `git status` shows only intended files; `package-lock.json` unchanged unless a dependency was deliberately
   added (and then verified with a clean `npm ci`).

---

## 7. Decisions I need from you before Stage 2

1. **Personal accounts:** should a personal user still get a workspace row (recommended — one tenancy model, zero
   special cases), or should personal finance live outside the workspace model?
2. **Multiple workspaces per user:** allow switching between a personal and a business workspace in one login?
   (Recommended; it is what makes the `ownerId` constraint change necessary.)
3. **Messaging providers:** confirm email-only first, with WhatsApp/SMS adapters wired but disabled until
   credentials and consent exist. This keeps the build honest and avoids fake delivery.
4. **Attachments:** confirm Supabase Storage private bucket with signed URLs (needs the service-role key already
   configured on Render).

Everything else — model names, endpoint shapes, stage order, permission matrix — I will follow as written here
unless you say otherwise.
