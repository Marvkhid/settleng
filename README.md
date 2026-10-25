# SettleNG

A simple finance tracker for small Nigerian businesses: sales, expenses, customer debts, invoices, payments and CSV reconciliation.

> SettleNG records what you enter. It does not connect to banks, hold money or process payments.

## Status

A production-ready app: Supabase Auth (email + password), multi-tenant data (each user sees only their own business), a NestJS API guarded by the Supabase access token, and a Next.js web app. Deploy it by following [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Structure

```text
settleng/
├── web/   Next.js (App Router), TypeScript strict, Tailwind v4, Supabase Auth (@supabase/ssr)
├── api/   NestJS 11, REST under /api, Swagger at /api/docs, Jest, Prisma
└── package.json   convenience scripts
```

Database: Prisma 7 + PostgreSQL on Supabase. Auth: Supabase Auth (email + password); the API verifies the access token against Supabase's JWKS.

## Start here

Requires **Node 20 or newer**. Run these from the folder that contains `package.json`.

```bash
npm run install:all     # installs api + web (retries on a flaky connection)
npm run doctor          # checks everything is in place and tells you how to fix what is not
```

Then configure both apps (see below) and run:

```bash
npm run dev             # API + web using the database + Supabase project in api/.env and web/.env.local
```

Open http://localhost:3000, sign up, and the dashboard starts empty (a brand-new business has no data yet).

| Command | What it does |
|---|---|
| `npm run dev` | API + web using the database in `api/.env` (Supabase). |
| `npm run doctor` | Diagnoses problems with your setup. |
| `npm run db:deploy` | Creates/updates the tables (`prisma migrate deploy`) using `api/.env`. |
| `npm run verify:deploy -- <website> <api>` | Checks a live deployment. |

**Windows:** if an install fails with `ECONNRESET` or `EPERM`, see [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md). Keep the project out of OneDrive/Desktop (for example `C:\dev\settleng`).

**Deploying:** [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) (Supabase + Render + Vercel, step by step, including Supabase Auth settings).

## Database and auth (Supabase)

1. In Supabase: **Connect** (or Project Settings > Database). Copy the *transaction pooler* string (port 6543) and the *session pooler* string (port 5432).
2. Put them in `api/.env` as `DATABASE_URL` (6543) and `DIRECT_URL` (5432). Also set `SUPABASE_URL`. Never commit this file.
3. Configure Supabase Auth (Site URL + redirect URLs) — see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).
4. Create the tables:

```bash
npm run db:deploy    # applies api/prisma/migrations (creates every table)
```

5. Paste `api/prisma/enable-rls.sql` into the Supabase SQL editor and run it once. It blocks Supabase's built-in public API from reading your tables; the NestJS API is the only way in.
6. `npm run dev` and open http://localhost:3000 to confirm it works before deploying.

The migrations in `api/prisma/migrations` are the single source of truth for the database structure: the tests build their databases from the same SQL.

## How auth and multi-tenancy work

- Users sign up / log in on the website (`/signup`, `/login`) with email + password via Supabase Auth.
- `web/middleware.ts` protects `/dashboard` and every app route, redirecting signed-out visitors to `/login`; signed-in users on an auth page go to `/dashboard`.
- On first sign-up the app calls `POST /api/auth/bootstrap`, which creates the user's **Profile** and their **Business** (owned by their Supabase user id).
- Every API request carries the Supabase access token as a `Bearer` header. A global `AuthGuard` verifies it (via Supabase JWKS) and scopes every query to that user's own business. A `businessId` sent from the browser is never trusted.
- Only `/api/health` and `/api/health/ready` are public.

## API overview (Swagger at `/api/docs`)

| Area | Endpoints |
|------|-----------|
| Health (public) | `GET /api/health`, `GET /api/health/ready` |
| Auth | `GET /api/auth/me`, `POST /api/auth/bootstrap`, `PATCH /api/auth/business` (business name), `DELETE /api/auth/account` |
| Dashboard | `GET /api/dashboard` |
| Quick actions | `POST /api/sales`, `POST /api/expenses` |
| Customers | `GET/POST /api/customers`, `GET/PATCH /api/customers/:id`, `POST /api/customers/:id/archive`, `.../restore`, `POST /api/customers/:id/payments` ("Customer paid me") |
| Invoices | `GET/POST /api/invoices`, `GET/PATCH/DELETE /api/invoices/:id`, `POST .../issue`, `.../void` |
| Payments | `GET/POST /api/invoices/:id/payments` |
| Transactions | `GET/POST /api/transactions`, `GET/PATCH/DELETE /api/transactions/:id`, `GET /api/transactions/categories` |
| Reports | `GET /api/reports/summary`, `/timeseries`, `/performance?period=7d|30d|90d|6m|1y`, `/customers-owing`, `/export?type=transactions|invoices|customers-owing` |
| Reconciliation | `GET /api/reconciliation/template`, `POST /preview`, `POST /imports`, `GET /imports`, `GET /imports/:id`, `POST /rows/:id/confirm`, `POST /rows/:id/reject` |
| Audit | `GET /api/audit` |

Money values are strings with two decimals (for example `"25000.00"`). The backend calculates every total, balance and status.

## Checks

```bash
npm run lint
npm test              # API unit tests
npm test --prefix web # web unit and DOM tests (vitest)
npm run test:e2e      # API wiring, database stubbed
npm run test:int      # full API on a throwaway real Postgres (starts and stops itself)
npm run build
```

## Environment variables

API (`api/.env`, see `api/.env.example`): `DATABASE_URL`, `DIRECT_URL`, `SUPABASE_URL`, `CORS_ORIGIN` (comma-separated exact URLs; **required in production**), `PORT`, `NODE_ENV`.
Optional: `DATABASE_CA`, `DATABASE_SSL`, `DATABASE_POOL_MAX`. Tests only: `SUPABASE_JWT_SECRET`, `THROTTLE_DISABLED=true`.
In production the API refuses to start if `DATABASE_URL`, `CORS_ORIGIN` or `SUPABASE_URL` is missing.
Web (`web/.env.local`, see `web/.env.example`): `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (read at **build** time).

Never commit real values. Only `.env.example` files are tracked.

## Notes

- Prisma 7 (driver adapter `@prisma/adapter-pg`); `prisma generate` runs on install and before build. Generated client lives in `api/src/generated` (git-ignored).
- NestJS is pinned to the 11.x line because it ships with Jest and ESLint as the spec requires; the newest Nest CLI scaffolds Vitest instead.
- Fonts (Bricolage Grotesque and Figtree) are self-hosted from `web/app/fonts`, so builds never depend on Google Fonts.
- UI components follow the shadcn/ui structure (`components.json`, `lib/utils.ts`) and are written by hand in `web/components/ui`.
