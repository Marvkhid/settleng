# SettleNG build phases (one project, one folder)

All phases live in this repository. Each phase is a commit series; nothing is split into separate projects.

| Phase | Scope | Status |
|-------|-------|--------|
| 1 Foundation | Monorepo, Next.js web, NestJS api, config, env templates | Done and verified |
| 2 Database | Prisma schema, deterministic seed, demo reset, Supabase-as-Postgres setup | Done. First `prisma migrate dev` is run by you against Supabase |
| 3 Backend | Customers, invoices, payments, transactions, reports/dashboard, reconciliation, audit, Swagger | Done and verified on real Postgres (42 integration tests) |
| 4 Frontend core | Landing, app shell, dashboard, customers, invoices, payments, transactions, settings | Done and verified in a real browser |
| 5 Reconciliation and reports UI | CSV upload flow, review, reports, exports | Done and verified: upload, preview, import, confirm/reject matches, history, reports, CSV downloads |
| 6 Polish and QA | Mobile/desktop pass, a11y, states, Playwright | Not started |
| 7 Deployment | Vercel + Node host + production Postgres, verified end to end | Not started |

## See it now, no credentials needed

```bash
npm run install:all
npm run preview      # local Postgres + sample data + API + web, all in one command
```

Open http://localhost:3000. Data lives in `api/.local-pg` (delete that folder to start fresh). Settings > Reset Demo restores the sample data.

## How to verify what is marked done

```bash
cd api
npm test            # unit tests (pure logic, no database)
npm run test:e2e    # app wiring with the database stubbed
npm run test:int    # full API against a throwaway real Postgres (no setup needed)
npm run lint && npm run build

cd ../web
npm test            # formatting + form validation tests
npm run lint && npm run build
npm run test:e2e    # drives the real UI in a browser (needs `npm run preview` running)
```

## Product rules decided during the build

- **Sales** = recorded sales (cash/transfer/POS) plus invoices on their issue date. Drafts and void invoices are ignored.
- **Money in** = every income record (recorded sales and customer payments). **Money out** = every expense.
- A **credit sale** creates a one-line invoice due in 14 days, so the debt appears in "Customers owing" and later payments settle it.
- **Customers owing** is the sum of open invoice balances right now (not limited to a date range).
- Invoice **status** is never stored; it is derived from items, payments and due date on every read.
- A CSV **suggested match never changes any money** until the user confirms it.
- "Today" is the date in Lagos (Africa/Lagos).
