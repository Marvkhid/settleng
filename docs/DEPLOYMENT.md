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

   > **This is what breaks confirmation links.** If **Site URL** is still `http://localhost:3000`, every
   > confirmation and reset link redirects there, even for people clicking from a phone on the live site.
   > Nothing consumes the token on that address, and a Supabase link only works **once** — so the next
   > attempt (or the same click after the redirect) reports `otp_expired` / `access_denied`.
   > Set Site URL to the live website before testing sign-up again.
   >
   > The site sends each link to its own callback (`/auth/confirm`), which verifies the token
   > server-side and only then starts a session. The default **Confirm signup** template works once
   > Site URL is right; for the most robust setup, point the template at the verifier directly:
   >
   > ```
   > {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup&next=/onboarding
   > ```
   >
   > Use the same pattern for **Reset password** with `type=recovery&next=/reset-password`.
2. In **Authentication > Providers > Email**, make sure **Email** is enabled and **Confirm email** is
   **off** (see the next section — registration does not depend on an email round-trip).
3. Note your **Project URL** and **anon / publishable key** (Project Settings > API) — the website needs both.

### Registration without email confirmation

SettleNG creates the account, starts the session and opens the dashboard in one step. Nothing is
emailed that has to be clicked. This needs one provider setting:

> **Confirm email** must be **off** (`mailer_autoconfirm = true`). With it on, Supabase refuses to
> return a session from sign-up, so every new account is stuck until a link is clicked.

You can flip it by hand in **Authentication > Providers > Email**, or let the script in this repo do it
(plus the Site URL and redirect list above, so they cannot drift again):

```bash
# Token from https://supabase.com/dashboard/account/tokens (not the anon or service_role key)
SUPABASE_ACCESS_TOKEN=sbp_... node scripts/supabase-auth-config.mjs --check   # show current values
SUPABASE_ACCESS_TOKEN=sbp_... node scripts/supabase-auth-config.mjs           # apply
```

What registering sends is a plain **informational** email: "your address was used to create a SettleNG
account, no action needed". It is fire-and-forget — if email fails, the account and the session are
unaffected. It is sent by `/api/signup-notice`, which only mails the signed-in caller's own address and
stays silent when no sender is configured:

| Variable (Vercel, server-side) | Purpose |
|-------------------------------|---------|
| `RESEND_API_KEY` | Enables the notification. Without it the email is skipped. |
| `SIGNUP_NOTICE_FROM` | Verified sender, e.g. `SettleNG <notifications@yourdomain.com>`. Defaults to Resend's test sender, which only delivers to your own account address. |

**Bot protection (optional, needs keys).** Put a Cloudflare Turnstile *secret* in Supabase and the
matching *site key* in Vercel, and Supabase rejects sign-ups, sign-ins and reset requests that skip the
challenge:

```bash
node scripts/supabase-auth-config.mjs --turnstile-secret=0x4AAAA...
```

```
# Vercel environment
NEXT_PUBLIC_TURNSTILE_SITE_KEY=0x4AAAA...
```

With no site key the widget does not render and nothing else changes.

Remaining dependence on email: **password reset**. There is no way around sending that link, so a
throttled mailer still breaks "forgot password" until custom SMTP is configured below.

### Make confirmation email reliable (custom SMTP)

Out of the box Supabase sends auth email from its own shared mailer. It is explicitly meant for
**testing**: the rate limit is a handful of messages per hour per project, and messages are frequently
filtered as spam by Gmail and Outlook. A new user who never sees that email cannot finish signing up, so
this — not the application code — is normally why "Create account" appears to do nothing.

Fix it once, in Supabase **Project Settings > Auth > SMTP Settings** (or **Authentication > Emails > SMTP**):

| Field | Value |
|-------|-------|
| Host | the provider's SMTP host, e.g. `smtp.resend.com` |
| Port | `587` (STARTTLS) or `465` (TLS) |
| Username | provider-specific, e.g. `resend` |
| Password | the provider's API key / SMTP password |
| Sender email | an address on a domain you have verified with that provider |
| Sender name | `SettleNG` |

Then turn **off** "Use default SMTP" and send yourself a test from
**Authentication > Emails**, or simply sign up once on the live site.

Practical constraint: most providers (Resend, Postmark, SendGrid) require you to verify a **domain**
before they will deliver to arbitrary recipients — a free mailbox address such as `@gmail.com` usually
cannot be the sender for real users. So this step realistically means buying a cheap domain
(e.g. `settleng.ng` or `settleng.com`), verifying it with the provider's DNS records, and sending from
`noreply@yourdomain`. Some providers also let you verify a single sender address without a domain; check
their current policy if you want to launch before buying one.

Email confirmation stays **off** by design (see "Registration without email confirmation"). Custom SMTP
is still worth setting up: it is what makes password-reset links arrive, and the optional sign-up
notification actually reach the person.

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

> **`P3005: The database schema is not empty`.** The tables already exist but Prisma has no record of
> creating them — usually because the database was set up by pasting `schema.sql` / running
> `prisma db push` instead of using the migrations. Do **not** reset the database; tell Prisma the two
> committed migrations are already applied:
>
> ```
> cd api
> npx prisma migrate resolve --applied 20261008000000_init
> npx prisma migrate resolve --applied 20261010000000_add_profiles_and_business_owner
> npx prisma migrate deploy      # should now report "No pending migrations"
> ```
>
> Only do this when the existing tables really match `api/prisma/schema.prisma`. Check first — this prints
> nothing when there is no difference:
>
> ```
> npx prisma migrate diff --from-url "$DIRECT_URL" --to-schema-datamodel prisma/schema.prisma --script
> ```
>
> After baselining, the API's start command (`prisma migrate deploy && node dist/main`) stops failing and the
> service boots.

## 3. Deploy the API (Render)

> **Package manager:** this repo is an **npm** workspace (one root `package-lock.json`, `workspaces: [api, web]`).
> Do not let Render use its auto-detected Yarn command. Yarn 1 fails immediately with
> `This project's package.json defines "packageManager"` before anything is installed. The blueprint
> below runs `bash scripts/render-build.sh`, which uses `npm ci` and stops at the first failure.
> Node is pinned to **22** by `.node-version`, so Render does not pick a brand-new major (it selected
> Node 26 for an earlier build, which is not what this stack is tested on).

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

### Already created the service by connecting the repo? Fix its settings

A service created with **New > Web Service** (instead of the Blueprint) keeps its own build command and
ignores `render.yaml`. That is why a build can fail with `yarn install` even though the blueprint is correct.
In the service's **Settings** page set:

| Setting | Value |
|---------|-------|
| Root Directory | *(empty — the repository root)* |
| Build Command | `bash scripts/render-build.sh` |
| Start Command | `npm run start:deploy --prefix api` |
| Health Check Path | `/api/health` |

Then **Manual Deploy > Clear build cache & deploy**. Alternatively delete the service and create it
again from the Blueprint, which applies all of the above automatically.

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

> **Dependencies (one lockfile for the whole repo).** The website and the API share the single
> `package-lock.json` at the repository root; there are no per-app lockfiles. Vercel resolves this
> workspace root even though its Root Directory is `web`, so that one file must stay complete for **every**
> platform — including the optional native binaries (`lightningcss-*`, `@tailwindcss/oxide-*`, `@next/swc-*`).
> A lockfile rewritten on a Windows machine that already has `node_modules/` silently drops the Linux ones,
> and the Vercel build then fails with `Cannot find module '../lightningcss.linux-x64-gnu.node'`.
> If you ever need to regenerate it, start from no lockfile and no `node_modules` so npm resolves all platforms:
> `rm -rf node_modules package-lock.json && npm install --package-lock-only && npm install`.

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
| `NEXT_PUBLIC_SITE_URL` | optional | Public site address used for canonical URLs, Open Graph and the sitemap. Defaults to `https://settleng.vercel.app`; set it when you move to a custom domain. |
| `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` | optional | Search Console verification token. The meta tag is emitted only when this is set. |
| `NEXT_PUBLIC_GA_ID` | optional | Google Analytics 4 measurement ID (`G-…`). Without it **no analytics script is loaded at all**. |

## Updating later

Push to GitHub. Vercel rebuilds the website and Render rebuilds the API (running any new migrations first).
Database migrations only move forward, so test them locally with `npm run dev` before pushing.

**Rolling back a bad release:** in Vercel, open the previous deployment and choose to promote/rollback to it; in Render, redeploy the previous commit.

## 7. Search, sharing and analytics

This is already in the code — nothing has to be built to go live:

| What | Where it comes from |
|------|--------------------|
| Per-page titles, descriptions, canonical URLs | each page's `metadata` (e.g. `app/about/page.tsx`) |
| Open Graph + Twitter card, 1200×630 share image | `app/opengraph-image.tsx` (generated at build) |
| Favicon (SVG), 180px Apple icon, web app manifest | `app/icon.svg`, `app/apple-icon.tsx`, `app/manifest.ts` |
| `robots.txt` and `sitemap.xml` | `app/robots.ts`, `app/sitemap.ts` (public pages only; signed-in routes are disallowed) |
| Structured data: Organization, WebSite, SoftwareApplication | `components/marketing/structured-data.tsx` (homepage) |
| HTTPS + HSTS + security headers | Vercel, plus `next.config.ts` |
| Skip-to-content link, one `h1` per page, labelled form fields | root layout and page components |

Two things need your own accounts:

1. **Google Search Console** — add `https://settleng.vercel.app` as a property. Choose the **HTML tag**
   verification method, copy only the `content="…"` token into Vercel as
   `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION`, redeploy, then press **Verify**. Submit
   `https://settleng.vercel.app/sitemap.xml` under **Sitemaps**.
2. **Google Analytics 4** — create a web data stream for the site, copy the `G-…` measurement ID into
   Vercel as `NEXT_PUBLIC_GA_ID`, and redeploy. Until that variable exists, no analytics script is
   requested at all (the privacy page says so, and it stays true).

Do not expect rankings immediately: a new domain is normally crawled within days and ranked slowly.
The technical groundwork above makes the site eligible; content and links decide the rest.

## 8. Capacity: what works today and what changes as accounts grow

These numbers are from the code in this repository, not estimates:

| Area | Current behaviour |
|------|------------------|
| List endpoints | Paginated: `page` (from 1), `pageSize` 20 by default, maximum 100 (`api/src/common/pagination.ts`) |
| Database indexes | 14 declared indexes/uniques, including `Transaction(businessId,date)`, `Transaction(businessId,type,date)`, `Invoice(businessId,dueDate)` and `Customer(businessId,name)` |
| Rate limiting | 120 requests per minute per IP (`ThrottlerModule`, trusts the proxy hop in production) |
| DB connections | Pool capped at 10 per API instance (`DATABASE_POOL_MAX`), behind Supabase's transaction pooler on 6543 |
| Auth | Supabase JWT verified against JWKS on every request; no server-side session store to scale |
| Tenant isolation | Every query is scoped by the signed-in user's own business on the server |

What that means in practice, honestly:

- **Single instance ceiling.** The API currently runs as one Render Node process. That comfortably
  serves hundreds of daily users; it is not designed for thousands of concurrent ones. Going bigger means
  a larger instance and `WEB_CONCURRENCY` above 1, or several instances: the API is stateless, so that is a
  hosting change, not a code change.
- **Connections are the first thing to break when you add instances.** Keep `DATABASE_POOL_MAX` at 3–5
  per instance once you run more than two, so the pooler is not exhausted.
- **Database size and backups.** Verify what your Supabase plan actually retains (point-in-time recovery is
  a paid feature; free plans have limited backup retention). Take a manual dump before risky migrations.
- **No error monitoring or uptime alerting is wired in.** This is the biggest operational gap: a suspended
  service or a failed deploy currently goes unnoticed until a user reports it. Point an external uptime check
  at `/api/health` and enable deploy-failure notifications in Render.
- **Free plans sleep.** An idle Render instance takes 30–60 seconds to answer the first request.

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
