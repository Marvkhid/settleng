# SettleNG

Portfolio demo of a simple finance tracker for small Nigerian businesses: sales, expenses, customer debts, invoices and payments.

> **Demo only.** SettleNG does not connect to banks, move money or process payments. All data is fictional sample data.

## Status

Phases 1 to 3 are complete (foundation, database layer, full backend). Phases 4 to 7 (UI, reconciliation UI, polish, deployment) are next. Details and rules: [`docs/PHASES.md`](docs/PHASES.md).

## Structure

```text
settleng/
├── web/   Next.js (App Router), TypeScript strict, Tailwind v4, shadcn/ui structure
├── api/   NestJS 11, REST under /api, Swagger at /api/docs, Jest
└── package.json   convenience scripts
```

Database: Prisma 7 + PostgreSQL. Supabase is used **only as the managed Postgres host** (no supabase-js, Supabase Auth or Storage).

## Local setup

Requires Node 20+ and npm.

```bash
npm run install:all
cp api/.env.example api/.env
cp web/.env.example web/.env.local
npm run dev:api   # http://localhost:4000/api/health, docs at /api/docs
npm run dev:web   # http://localhost:3000
```

## Database (Supabase as plain Postgres)

1. In Supabase: **Project Settings > Database > Connection string**. Copy the *transaction pooler* URL (port 6543) and the *session pooler / direct* URL (port 5432).
2. Put them in `api/.env` as `DATABASE_URL` (pooled, port 6543) and `DIRECT_URL`. Never commit this file.
3. Create the tables and load sample data:

```bash
cd api
npx prisma migrate dev --name init   # creates prisma/migrations and applies it (uses DIRECT_URL)
npm run db:seed                      # loads Adeola Mini Mart sample data (repeatable)
```

4. Paste `api/prisma/enable-rls.sql` into the Supabase SQL editor and run it once. It blocks Supabase's built-in public API from reading your tables; the NestJS API is the only way in.
5. Commit the generated `api/prisma/migrations/` folder.

Production deploys use `npm run db:deploy` (`prisma migrate deploy`).

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

API (`api/.env`): `PORT`, `NODE_ENV`, `CORS_ORIGIN` (comma-separated), `DEMO_MODE`, `DATABASE_URL`, `DIRECT_URL`. Tests only: `THROTTLE_DISABLED=true` turns off rate limiting.
Web (`web/.env.local`): `NEXT_PUBLIC_API_URL`.

Never commit real values. Only `.env.example` files are tracked.

## Production (summary; full guide in Phase 7)

- Frontend: deploy `web/` to Vercel and set `NEXT_PUBLIC_API_URL`.
- Backend: deploy `api/` to a Node.js host and set `CORS_ORIGIN` to the Vercel URL.
- Database: managed PostgreSQL (for example Neon).

## Notes

- Prisma 7 (driver adapter `@prisma/adapter-pg`); `prisma generate` runs on install and before build. Generated client lives in `api/src/generated` (git-ignored).
- NestJS is pinned to the 11.x line because it ships with Jest and ESLint as the spec requires; the newest Nest CLI scaffolds Vitest instead.
- Inter is self-hosted from `web/app/fonts` so builds never depend on Google Fonts.
- shadcn components are added by hand-compatible structure (`components.json`, `lib/utils.ts`); further components are added in Phase 4.
