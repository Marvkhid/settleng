# SettleNG

Portfolio demo of a simple finance tracker for small Nigerian businesses: sales, expenses, customer debts, invoices and payments.

> **Demo only.** SettleNG does not connect to banks, move money or process payments. All data is fictional sample data.

## Status

**Phase 1 (foundation) complete.** Database, API features and the real UI come in later phases. See the master specification for the full plan.

## Structure

```text
settleng/
├── web/   Next.js (App Router), TypeScript strict, Tailwind v4, shadcn/ui structure
├── api/   NestJS 11, REST under /api, Swagger at /api/docs, Jest
└── package.json   convenience scripts
```

Planned later: Prisma + PostgreSQL (Phase 2).

## Local setup

Requires Node 20+ and npm.

```bash
npm run install:all
cp api/.env.example api/.env
cp web/.env.example web/.env.local
npm run dev:api   # http://localhost:4000/api/health, docs at /api/docs
npm run dev:web   # http://localhost:3000
```

## Checks

```bash
npm run lint
npm test
npm run test:e2e
npm run build
```

## Environment variables

API (`api/.env`): `PORT`, `NODE_ENV`, `CORS_ORIGIN` (comma-separated), `DEMO_MODE`, `DATABASE_URL` (used from Phase 2).
Web (`web/.env.local`): `NEXT_PUBLIC_API_URL`.

Never commit real values. Only `.env.example` files are tracked.

## Production (summary; full guide in Phase 7)

- Frontend: deploy `web/` to Vercel and set `NEXT_PUBLIC_API_URL`.
- Backend: deploy `api/` to a Node.js host and set `CORS_ORIGIN` to the Vercel URL.
- Database: managed PostgreSQL (for example Neon).

## Notes

- NestJS is pinned to the 11.x line because it ships with Jest and ESLint as the spec requires; the newest Nest CLI scaffolds Vitest instead.
- Inter is self-hosted from `web/app/fonts` so builds never depend on Google Fonts.
- shadcn components are added by hand-compatible structure (`components.json`, `lib/utils.ts`); further components are added in Phase 4.
