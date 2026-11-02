# Smart Debt Reminders — production configuration

Reminders are sent by the API, not the browser. The web app only writes reminder settings; a
scheduled HTTP call to the API decides when to email, so reminders keep working when the owner is
signed out or offline.

## Required environment variables (API service)

| Variable | Required | Purpose |
| --- | --- | --- |
| `RESEND_API_KEY` | yes | Sends the reminder email. Without it every delivery is recorded as `SKIPPED` (`no_provider`), never as sent. |
| `CRON_SECRET` | yes | Shared secret the scheduler presents. Unset ⇒ the dispatch endpoint returns **404** so it cannot be probed; wrong secret ⇒ **403**. |
| `APP_URL` | yes | Public site origin used for the debt links in every email (e.g. `https://settleng.com`). Defaults to `http://localhost:3000`. |
| `RESEND_BASE_URL` | no | Overrides the Resend endpoint (`https://api.resend.com`). Used by the local test sink; leave unset in production. |
| `DATABASE_URL` | yes | Existing Postgres/Supabase connection. |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | yes | Existing auth/DB configuration. |

`CRON_SECRET` is only ever read on the server. It is never sent to the browser and never logged.
Generate one with `openssl rand -hex 32` and store it in the host's secret manager, not in the repo.

## The scheduler call

```
POST https://<api-host>/api/internal/debt-reminders/dispatch
x-cron-secret: $CRON_SECRET
```

Run it **every 15 minutes**. `*/15 * * * *` is correct for all supported frequencies: each reminder
row stores the exact UTC instant it is next due, the dispatch selects rows with `nextRunAt <= now`,
and sends at most one email per owner per window. Running more often is harmless (a window already
claimed is skipped); running less often delays reminders.

The optional `?at=<ISO-8601>` parameter runs a window as if the clock read that instant. It exists
for backfilling after downtime and for tests; it does not override deduplication.

Render (cron job):

```
Schedule:  */15 * * * *
Command:   curl -fsS -X POST "$API_URL/api/internal/debt-reminders/dispatch" -H "x-cron-secret: $CRON_SECRET"
```

GitHub Actions (equivalent):

```yaml
on:
  schedule: [{ cron: '*/15 * * * *' }]
jobs:
  dispatch:
    runs-on: ubuntu-latest
    steps:
      - run: |
          curl -fsS -X POST "${{ secrets.API_URL }}/api/internal/debt-reminders/dispatch" \
            -H "x-cron-secret: ${{ secrets.CRON_SECRET }}"
```

Vercel Cron is not usable for this route unless the API is deployed on Vercel; the endpoint lives in
the NestJS service, so point whichever scheduler already runs there.

## Delivery behaviour you can rely on

- **One email per owner per window.** A unique `windowKey` (`workspaceId:ownerUserId:slot`) plus an
  atomic claim of `nextRunAt` makes a duplicate run, a retried request, or a restart send nothing.
- **Owner only.** The recipient is the signed-in owner's verified email; the debtor's address is
  never used and never stored for reminders.
- **Balance is re-read at send time.** A payment or write-off recorded a second earlier is respected.
- **Settlement cancels immediately.** Clearing the balance disables the reminder in the same
  transaction (`lastError = debt_settled`).
- **Failures are visible.** A failed send is stored as `FAILED` with the provider error and retried
  after 15 minutes; after 3 consecutive failures the reminder is disabled with
  `lastError = retry_limit_reached`.
- **Quiet hours.** Times between 22:00 and 05:59 are refused at save time.

## Verifying a deployment

1. `POST /api/internal/debt-reminders/dispatch` without `x-cron-secret` → `403`.
2. `GET /api/debt-reminders` while signed out → `401`.
3. Enable a reminder, then call dispatch with `?at=` just past its `nextRunAt`; the response should
   contain `{"status":"SENT"}` and the owner's inbox should receive one email.
4. Call dispatch again with the same `at`; the response must be empty (`processed: 0`).

A local run against `tools/email-sink.mjs` proves the API generates and submits real HTTP email
requests, but it is **not** proof of inbox delivery. Only step 3 against a real Resend key does that.

## Production verification runbook (deploy-day checks)

Everything below must be run against the **deployed** API, not a laptop, and the results written down.
Nothing here is proof until the email is read in the owner's real inbox.

### 1. API environment (Render → settleng-api → Environment)

| Key | Value |
| --- | --- |
| `DATABASE_URL` | Supabase pooled string (port 6543) |
| `DIRECT_URL` | Supabase direct string (port 5432), used for `prisma migrate deploy` |
| `SUPABASE_URL` | `https://<project>.supabase.co` |
| `CORS_ORIGIN` | the deployed web origin, e.g. `https://settleng.vercel.app` |
| `APP_URL` | same public origin; used inside reminder email links |
| `CRON_SECRET` | `openssl rand -hex 32` — paste the same value into the cron job |
| `RESEND_API_KEY` | Resend API key (server-side only; never in the web app) |

`render.yaml` already declares these with `sync: false`, so Render prompts for them on first deploy.

### 2. Cron

`POST https://<api-host>/api/internal/debt-reminders/dispatch` every 15 minutes with header
`x-cron-secret: <CRON_SECRET>`. Any scheduler works (Render Cron Job, cron-job.org, GitHub Actions).
The endpoint returns 404 when `CRON_SECRET` is unset, 403 when the header is wrong, and `200` with
`{ processed, sent, failed, skipped }` when it runs.

### 3. Controlled test account

Create a **new** account you own (never a real customer), add one debt, and enable reminders with the
next slot a few minutes away in that account's timezone. Confirm `/reminders` shows the correct
`nextRunAt`.

### 4. Delivery

Wait for the cron slot, then check:

- the email arrives in the owner's inbox (not spam) with the right amount (`₦6,000`, not `₦6000.00`);
- `/reminders` shows the delivery as `SENT` with a provider id;
- the debt link in the email opens the right debt after signing in.

### 5. Duplicate protection

Immediately dispatch again and compare inbox counts:

```bash
curl -sS -X POST "https://<api-host>/api/internal/debt-reminders/dispatch" \
  -H "x-cron-secret: $CRON_SECRET" | jq
```

Expect `processed: 0` (or no `sent`) and exactly **one** email for that slot.

### 6. Lifecycle on the deployed app

- partial payment lowers the balance and the next email shows the remainder;
- full repayment closes the debt, disables its reminder, and no further email arrives;
- pause stops sending and resume continues from the next slot;
- turning reminders off and deleting the debt both end delivery;
- every delivery attempt is visible in the history with its provider answer.

### 7. Isolation

With a second account, request the first account's debt/reminder ids directly (with and without a
spoofed `x-workspace-id`). Every call must be `404`, and the second account's `/reminders` must be
empty. This is the check that the local suite automates (`tools/e2e-reminders.mjs`, 62 assertions);
re-running it against production only makes sense for the non-email parts.
