# Troubleshooting

Start with `npm run doctor`. It checks Node, npm, your folder, installed dependencies, the generated database client and free ports,
and tells you what to do about each problem.

## Installing

| What you see | What it means | What to do |
|---|---|---|
| `npm error Missing script: "dev"` (at the project root) | Older versions of the project had no `dev` command. | Use the current project: `npm run dev` (needs `api/.env`, see below) or `npm run preview` (no setup). |
| `'concurrently' is not recognized` | A `dev` script that needs the `concurrently` package was added somewhere, but that package was never installed. | Use the project's own `npm run dev` / `npm run preview`, which need no extra package. |
| `npm error code ECONNRESET` ... `network read ECONNRESET` | Your internet connection dropped while downloading. | Run `npm run install:all` again (it retries automatically). Turn off any VPN/proxy, or try a phone hotspot. If it keeps failing: `npm cache verify`. |
| `npm warn cleanup Failed to remove some directories ... EPERM: operation not permitted, rmdir` | Windows had files locked (OneDrive, antivirus or an open editor), so npm could not clean up after a failed install. | Close VS Code and other terminals in the folder, pause OneDrive, then `npm run install:all -- --clean`. Best: move the project out of Desktop/Documents to `C:\dev\settleng`. |
| `Cannot find path '...\settleng\settleng'` | You were already inside the project folder when you ran `cd settleng`. | Nothing is wrong. Run commands from the folder that contains `package.json`. |
| `npm warn deprecated glob / eslint` | Notices about tools' versions. | Safe to ignore. |
| `prisma generate` fails or says it cannot download | Prisma downloads small engine files during install and the network failed. | `npm run install:all -- --clean` once your connection is stable. |

**A clean reinstall on Windows (PowerShell):** `Remove-Item -Recurse -Force api\node_modules, web\node_modules` then `npm run install:all`.
(`npm run install:all -- --clean` does this for you, with retries for locked files.)

Tip: in older Windows PowerShell, `&&` between commands does not work. Run commands one per line, or separate them with `;`.

## Running locally

| What you see | What to do |
|---|---|
| `npm run dev` says no database is configured | Copy `api/.env.example` to `api/.env` and fill in `DATABASE_URL` and `DIRECT_URL`, or use `npm run preview` (it creates a local database for you). |
| `npm run preview` is slow the first time | It sets up a local database and compiles pages once. Later runs are quicker. Allow the Windows Firewall prompt if it appears. |
| `Port 3000 (or 4000) is already in use` | Another copy is running. Close it, or find it with `netstat -ano \| findstr :3000` and end that process. |
| Pages show "We can't reach the server right now" | The API is not running or `web/.env.local` points at the wrong address. It should contain `NEXT_PUBLIC_API_URL=http://localhost:4000`. Restart the web app after changing it. |
| `NEXT_PUBLIC_API_URL is not set` | Create `web/.env.local` with the line above (`npm run preview` / `npm run dev` create it for you). |
| To start over with the local sample data | Stop everything, delete the folder `api/.local-pg`, run `npm run preview`. |

## Supabase

| What you see | Cause and fix |
|---|---|
| `P1001: Can't reach database server` | Wrong string, or the **Direct connection** string on an IPv4-only network. Use the **Session pooler** string for `DIRECT_URL`. |
| `password authentication failed` | Wrong password, or special characters not URL-encoded. Reset the password in Supabase using letters and numbers only. |
| `self-signed certificate in certificate chain` | Only possible if SSL settings were overridden. Remove `sslmode=` from your strings (the API handles SSL), or set `DATABASE_CA`. |
| `prepared statement "s0" already exists` / similar | You used the pooled (6543) string for migrations. Migrations must use `DIRECT_URL` (5432). |
| The site loads but shows no data | The tables exist but are empty: open **Settings > Reset Demo**, or run `npm run db:seed`. `https://YOUR-API/api/health/ready` says `"sampleData":"missing"` in this case. |

## After deploying

| What you see | Cause and fix |
|---|---|
| Browser console: `blocked by CORS policy` | `CORS_ORIGIN` on the API does not exactly match your website's address (check `http` vs `https`, `www`, trailing slash). Fix it and redeploy the API. |
| Site shows errors only on the first visit after a while | The free-tier API was asleep. Wait up to a minute, then press **Try again**. |
| Website calls `localhost:4000` | It was built without `NEXT_PUBLIC_API_URL`. Set it on Vercel and **redeploy** (it is read at build time). |
| API will not start: `Cannot start in production: ...` | The message lists exactly which setting is missing (`DATABASE_URL` or `CORS_ORIGIN`). Add it on the host. |
| Everything is slow or rate limited for everyone at once | Make sure `NODE_ENV=production` is set on the API (it then trusts the host's proxy to see each visitor's own address). |

Run `npm run verify:deploy -- <website> <api>` any time to re-check a live deployment.
