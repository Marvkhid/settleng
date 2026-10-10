# Deploying SettleNG

Three pieces, three places:

```
Visitor's phone/browser
        |
        v
  Vercel  (the website, folder web/)              <- NEXT_PUBLIC_API_URL + NEXT_PUBLIC_SUPABASE_*
        |
        v
  Render / Railway / Fly  (the API, folder api/)  <- CORS_ORIGIN = your website's address, SUPABASE_URL
        |
        v
  Supabase  (PostgreSQL + Supabase Auth)
```

Do the steps in this order. Each one ends with a check, so you know it worked before you move on.
Budget about an hour the first time.

> **Before you start:** the project must be on GitHub (Render and Vercel deploy from a repository).
> In the project folder run `git remote add origin https://github.com/YOUR-NAME/settleng.git` then
> `git push -u origin master` (create the empty repository on github.com first).
> **Never commit `api/.env` or `web/.env.local`**: `.gitignore` already blocks them.

---

## 1. Create the project and database (Supabase)

1. Sign in at supabase.com and create a **New project**. Pick a region close to your users and set a **strong database password**.
   Write it down. If it contains characters like `@ / : # ?`, you must URL-encode them in the connection strings below (easiest: use only letters and numbers).
2. When the project is ready, click **Connect** (top of the project page), or go to **Project Settings > Database**, and copy two connection strings:
   - **Transaction pooler** (port **6543**): this becomes `DATABASE_URL`.
   - **Session pooler** (port **5432**): this becomes `DIRECT_URL`.
     (The "Direct connection" string also uses 5432, but it needs IPv6. Many home and office networks only have IPv4, so use the **Session pooler** string.)
3. Replace `[YOUR-PASSWORD]` in both strings with your password.

### Configure Supabase Auth

SettleNG signs users in with Supabase Auth (email + password). Configure the redirect URLs so the
emailed confirmation and password-reset links send people back to your site.

1. In Supabase open **Authentication > URL Configuration**:
   - **Site URL**: your website address, e.g. `https://settleng.vercel.app`.
   - **Redirect URLs**: add all of these:
     - `https://settleng.vercel.app`
     - `https://settleng.vercel.app/**`
     - `http://localhost:3000` (for local development)
2. In **Authentication > Providers > Email**, make sure **Email** is enabled. For a smooth first run you
   can turn **Confirm email** off; leave it on for production (users click a link before their first login).
3. Note your **Project URL** and **anon / publishable key** (Project Settings > API) — the website needs both.

## 2. Create the tables (from your computer)

1. Copy `api/.env.example` to `api/.env` and paste your two connection strings into `DATABASE_URL` and `DIRECT_URL`.
   Also set `SUPABASE_URL` to your Supabase project URL (from step 1.3).
2. In the project folder apply the committed migrations:
   ```
   npm run db:deploy      # runs `prisma migrate deploy`: creates every table
   ```
3. In Supabase open **SQL Editor**, paste the contents of `api/prisma/enable-rls.sql`, and run it once.
   It locks Supabase's own public API so the only way into your data is your SettleNG API.
4. **Check it locally before deploying anything:** run `npm run dev`, open http://localhost:3000, sign up,
   and confirm the dashboard shows zeros (a brand-new business is empty by design).

> `db:deploy` applies `api/prisma/migrations/`. If you later run `npx prisma migrate dev` and Prisma proposes a
> small follow-up migration, accept it (commit the new folder); nothing is lost.

## 3. Deploy the API (Render)

1. On render.com choose **New > Blueprint**, connect your GitHub repo, and select it. Render reads `render.yaml`.
2. It asks for these secret values:
   | Name | Value |
   |------|-------|
   | `DATABASE_URL` | the **Transaction pooler** string (port 6543) |
   | `DIRECT_URL` | the **Session pooler** string (port 5432) |
   | `SUPABASE_URL` | your Supabase project URL, e.g. `https://xyz.supabase.co` (the API verifies sign-in tokens against it) |
   | `CORS_ORIGIN` | the address your website will have, e.g. `https://settleng.vercel.app` (exact, no trailing slash). If unsure, make your best guess; confirm it in step 5. |
3. Deploy. When it finishes you get an address like `https://settleng-api.onrender.com`.
4. **Check:** open `https://YOUR-API/api/health` (shows `"status":"ok"`) and `https://YOUR-API/api/health/ready`
   (shows `"database":"up"`). Also confirm a protected route returns 401 without a token, e.g. `https://YOUR-API/api/dashboard`.

The API applies any new database migrations every time it starts (`npm run start:deploy`).

**Other hosts (Railway, Fly.io, any Docker host):** use `api/Dockerfile` (build context = the `api` folder), set the same
environment variables, and set the health check path to `/api/health`. The host provides `PORT`; the API reads it.

**Free plans sleep.** After a while without visitors the API stops, and the first request afterwards can take 30 to 60 seconds.
The website shows its loading states meanwhile.

## 4. Deploy the website (Vercel)

1. On vercel.com choose **Add New > Project** and import the same GitHub repo.
2. Set **Root Directory** to `web`. (Framework should be detected as Next.js.)
3. Under **Environment Variables** add:
   | Name | Value |
   |------|-------|
   | `NEXT_PUBLIC_API_URL` | your API address from step 3, e.g. `https://settleng-api.onrender.com` (no trailing slash, **no** `/api`) |
   | `NEXT_PUBLIC_SUPABASE_URL` | your Supabase project URL (same as the API's `SUPABASE_URL`) |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | your Supabase anon / publishable key |
4. Deploy. Vercel gives you an address like `https://settleng.vercel.app`.

> `NEXT_PUBLIC_*` values are baked in when the site is **built**. If you change them later you must **redeploy** the site.
> If you forget `NEXT_PUBLIC_API_URL`, the build fails on purpose with a message saying so.

## 5. Make the API accept your website

If the website address Vercel gave you is exactly what you put in `CORS_ORIGIN`, skip this.
Otherwise: on Render open your API service > **Environment**, set `CORS_ORIGIN` to the real website address, and save (it restarts).

To also allow Vercel's per-branch preview sites, use a comma-separated list with one wildcard:
`https://settleng.vercel.app,https://settleng-*.vercel.app`

Also update Supabase **Authentication > URL Configuration** (step 1) to include the final website address, so sign-in
and password-reset emails link back to the right place.

## 6. Verify the live deployment

```
npm run verify:deploy -- https://YOUR-WEBSITE https://YOUR-API
```

It checks: both are https, the API is awake, the database answers, protected routes return 401 without a token,
CORS allows your website (and only it), saving data will work from a browser, the website loads, signed-out visitors
are redirected to /login, and the website was really built pointing at your API. Every failed check tells you what to change.

Then do the human check on your phone: open the site, **sign up**, record a sale, refresh and confirm it is still there.

---

## Environment variables (summary)

**API (`api/.env`, set as secrets on your host):**

| Name | Required | Purpose |
|------|----------|---------|
| `DATABASE_URL` | production | Pooled Postgres connection (port 6543) |
| `DIRECT_URL` | production | Session/direct connection for migrations (port 5432) |
| `SUPABASE_URL` | production | Your Supabase project URL; the API verifies JWTs against its JWKS |
| `SUPABASE_JWT_SECRET` | local/tests only | HS256 fallback instead of JWKS; leave unset in production |
| `CORS_ORIGIN` | production | Exact website URL(s) allowed to call the API |
| `PORT` | optional | Defaults to 4000 (the host usually sets it) |
| `NODE_ENV` | production | Set to `production` on the host |
| `DATABASE_CA` / `DATABASE_SSL` / `DATABASE_POOL_MAX` | optional | Database SSL tuning |
| `THROTTLE_DISABLED` | optional | `true` disables rate limiting (never in production) |

**Website (Vercel, `NEXT_PUBLIC_*`):**

| Name | Required | Purpose |
|------|----------|---------|
| `NEXT_PUBLIC_API_URL` | yes | Base URL of the API (no trailing slash, no `/api`) |
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | Supabase anon / publishable key |

## Updating later

Push to GitHub. Vercel rebuilds the website and Render rebuilds the API (running any new migrations first).
Database migrations only move forward, so test them locally with `npm run dev` before pushing.

**Rolling back a bad release:** in Vercel, open the previous deployment and choose to promote/rollback to it; in Render, redeploy the previous commit.

## Security notes

- Never commit `.env` files, and never paste your database password or service keys into the website's settings
  (`NEXT_PUBLIC_*` values are public — only the anon key belongs there, never the service_role key).
- Every API route except `/api/health` requires a valid Supabase access token. Each request is scoped to the
  signed-in user's own business on the server; a `businessId` sent from the browser is ignored.
- If a password is exposed, reset it in Supabase and update `DATABASE_URL` and `DIRECT_URL` everywhere.
- The API uses SSL for the database automatically. To also verify Supabase's certificate, set `DATABASE_CA` to the CA certificate from
  Supabase (Project Settings > Database > SSL), written on one line with `\n` for line breaks.

## What was and was not verified

Verified in the build environment: the migration SQL applies cleanly on a real Postgres; the built API boots in production mode,
refuses unsafe settings, serves health/readiness, requires a token on protected routes, applies the CORS rule, and the unit test
suite passes; the website builds and both apps lint clean.

Not verifiable without your accounts, so please confirm with `verify:deploy`: the actual Supabase connection (SSL, pooler, password),
a real end-to-end sign-in, the Render/Vercel build settings, and your final URLs.
