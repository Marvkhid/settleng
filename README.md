# SettleNG

Portfolio demo of a simple finance tracker for small Nigerian businesses: sales, expenses, customer debts, invoices and payments.

> **Demo only.** SettleNG does not connect to banks, move money or process payments. All data is fictional sample data.

## Status

Phases 1 to 6 are complete (foundation, database, backend, web app, CSV matching and reports, accessibility and QA). Phase 7 (deployment) is prepared and tested locally; the live deployment needs your accounts: follow [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md). Details and rules: [`docs/PHASES.md`](docs/PHASES.md).

## Structure

```text
settleng/
├── web/   Next.js (App Router), TypeScript strict, Tailwind v4, shadcn/ui structure
├── api/   NestJS 11, REST under /api, Swagger at /api/docs, Jest
└── package.json   convenience scripts
```

Database: Prisma 7 + PostgreSQL. Supabase is used **only as the managed Postgres host** (no supabase-js, Supabase Auth or Storage).

## Start here

Requires **Node 20 or newer**. Run these from the folder that contains `package.json`.

```bash
npm run install:all     # installs api + web (retries on a flaky connection)
npm run doctor          # checks everything is in place and tells you how to fix what is not
npm run preview         # try the real app now: local database + sample data + API + web, no accounts needed
```

Open http://localhost:3000. Stop with Ctrl+C.

| Command | What it does |
|---|---|
| `npm run preview` | Everything on your machine, including a throwaway local database. Nothing to configure. |
| `npm run dev` | API + web using the database in `api/.env` (for example Supabase). |
| `npm run doctor` | Diagnoses problems with your setup. |
| `npm run db:deploy` / `npm run db:seed` | Create the tables / load the sample business in the database from `api/.env`. |
| `npm run verify:deploy -- <website> <api>` | Checks a live deployment. |

**Windows:** if an install fails with `ECONNRESET` or `EPERM`, see [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md). Keep the project out of OneDrive/Desktop (for example `C:\dev\settleng`).

**Deploying:** [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) (Supabase + Render + Vercel, step by step).

## Database (Supabase as plain Postgres)

Supabase is used **only as the managed Postgres host**: no supabase-js, Supabase Auth or Storage.

1. In Supabase: **Connect** (or Project Settings > Database). Copy the *transaction pooler* string (port 6543) and the *session pooler* string (port 5432).
2. Put them in `api/.env` as `DATABASE_URL` (6543) and `DIRECT_URL` (5432). Never commit this file.
3. Create the tables and load the sample data:

```bash
npm run db:deploy    # applies api/prisma/migrations (creates all tables)
npm run db:seed      # loads the Adeola Mini Mart sample business (repeatable)
```

4. Paste `api/prisma/enable-rls.sql` into the Supabase SQL editor and run it once. It blocks Supabase's built-in public API from reading your tables; the NestJS API is the only way in.
5. `npm run dev` and open http://localhost:3000 to confirm it works before deploying. Full deployment steps: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

The migration in `api/prisma/migrations` is the single source of truth for the database structure: the tests and `npm run preview` build their databases from the same SQL.

**Reset demo:** `POST /api/demo/reset` restores the original sample data in one database transaction. It only works while `DEMO_MODE=true` and is rate limited.

## API overview (Swagger at `/api/docs`)

| Area | Endpoints |
|------|-----------|
| Health / demo | `GET /api/health`, `GET /api/demo/workspace`, `POST /api/demo/reset` |
| Dashboard | `GET /api/dashboard` |
| Quick actions | `POST /api/sales`, `POST /api/expenses` |
| Customers | `GET/POST /api/customers`, `GET/PATCH /api/customers/:id`, `POST /api/customers/:id/archive`, `.../restore`, `POST /api/customers/:id/payments` ("Customer paid me") |
| Invoices | `GET/POST /api/invoices`, `GET/PATCH/DELETE /api/invoices/:id`, `POST .../issue`, `.../void` |
| Payments | `GET/POST /api/invoices/:id/payments` |
| Transactions | `GET/POST /api/transactions`, `GET/PATCH/DELETE /api/transactions/:id`, `GET /api/transactions/categories` |
| Reports | `GET /api/reports/summary`, `/timeseries`, `/customers-owing`, `/export?type=transactions|invoices|customers-owing` |
| Reconciliation | `GET /api/reconciliation/template`, `POST /preview`, `POST /imports`, `GET /imports`, `GET /imports/:id`, `POST /rows/:id/confirm`, `POST /rows/:id/reject` |
| Audit | `GET /api/audit` |

Money values are strings with two decimals (for example `"25000.00"`). The backend calculates every total, balance and status.

## Checks

```bash
npm run lint
npm test              # unit tests
npm run test:e2e      # wiring, database stubbed
npm run test:int      # full API on a throwaway real Postgres (starts and stops itself)
npm run build
```

## Environment variables

API (`api/.env`, see `api/.env.example`): `DATABASE_URL`, `DIRECT_URL`, `CORS_ORIGIN` (comma-separated exact URLs; **required in production**), `DEMO_MODE`, `PORT`, `NODE_ENV`.
Optional: `DATABASE_CA`, `DATABASE_SSL`, `DATABASE_POOL_MAX`. Tests only: `THROTTLE_DISABLED=true`.
In production the API refuses to start if `DATABASE_URL` or `CORS_ORIGIN` is missing.
Web (`web/.env.local`): `NEXT_PUBLIC_API_URL` (read at **build** time).

Never commit real values. Only `.env.example` files are tracked.

## Notes

- Prisma 7 (driver adapter `@prisma/adapter-pg`); `prisma generate` runs on install and before build. Generated client lives in `api/src/generated` (git-ignored).
- NestJS is pinned to the 11.x line because it ships with Jest and ESLint as the spec requires; the newest Nest CLI scaffolds Vitest instead.
- Fonts (Bricolage Grotesque and Figtree) are self-hosted from `web/app/fonts`, so builds never depend on Google Fonts.
- UI components follow the shadcn/ui structure (`components.json`, `lib/utils.ts`) and are written by hand in `web/components/ui`.
