// Checks a LIVE deployment end to end.   node scripts/verify-deploy.mjs <WEBSITE_URL> <API_URL>
// Example: node scripts/verify-deploy.mjs https://settleng.vercel.app https://settleng-api.onrender.com
const [webArg, apiArg] = process.argv.slice(2);
if (!webArg || !apiArg) {
  console.error('Usage: node scripts/verify-deploy.mjs <WEBSITE_URL> <API_URL>\nExample: node scripts/verify-deploy.mjs https://settleng.vercel.app https://settleng-api.onrender.com');
  process.exit(2);
}
const clean = (u) => u.trim().replace(/\/+$/, '');
const WEB = clean(webArg), API = clean(apiArg);
const results = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const isLocal = (u) => /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(u);
async function check(name, fn) {
  try { const note = await fn(); results.push({ ok: true, name, note }); console.log(`  \u2713 ${name}${note ? `  (${note})` : ''}`); }
  catch (e) { results.push({ ok: false, name, note: e.message }); console.log(`  \u2717 ${name}\n      ${e.message.split('\n').join('\n      ')}`); }
}
const get = (url, init) => fetch(url, { redirect: 'follow', ...init });

console.log(`\nChecking SettleNG deployment\n  website: ${WEB}\n  api:     ${API}\n`);

await check('Both addresses use https (required for a public site)', async () => {
  for (const u of [WEB, API]) if (!u.startsWith('https://') && !isLocal(u)) throw new Error(`${u} is not https. Browsers block an https site from calling an http API.`);
});

let apiAwake = false;
await check('API is running (waits up to 90s for a sleeping free-tier host to wake)', async () => {
  const t0 = Date.now(); let last = '';
  while (Date.now() - t0 < 90000) {
    try { const r = await get(`${API}/api/health`); if (r.ok) { apiAwake = true; return `${Math.round((Date.now() - t0) / 1000)}s`; } last = `HTTP ${r.status}`; } catch (e) { last = e.cause?.code ?? e.message; }
    await sleep(3000);
  }
  throw new Error(`No healthy answer from ${API}/api/health (${last}). Check the host's logs: a missing DATABASE_URL or CORS_ORIGIN stops the API from starting.`);
});

if (apiAwake) {
  await check('API can reach the database', async () => {
    const r = await get(`${API}/api/health/ready`); const b = await r.json().catch(() => ({}));
    if (r.status !== 200) throw new Error(`${b.message ?? `HTTP ${r.status}`}\nCheck DATABASE_URL (use the pooled port-6543 string) and that migrations ran (npm run db:deploy).`);
    return `database ${b.database}`;
  });
  await check('Protected API routes require a signed-in token (401 without)', async () => {
    const r = await get(`${API}/api/dashboard`);
    if (r.status !== 401) throw new Error(`/api/dashboard returned HTTP ${r.status}, expected 401 for an anonymous request. The AuthGuard may not be applied globally.`);
  });
  await check('API allows YOUR website (CORS), and blocks other sites', async () => {
    const ok = (await get(`${API}/api/health`, { headers: { Origin: WEB } })).headers.get('access-control-allow-origin');
    if (ok !== WEB) throw new Error(`The API does not allow ${WEB}. Set CORS_ORIGIN on the API host to exactly ${WEB} and redeploy it. (Got: ${ok ?? 'no header'})`);
    const evil = (await get(`${API}/api/health`, { headers: { Origin: 'https://evil.example' } })).headers.get('access-control-allow-origin');
    if (evil) throw new Error('The API allows any website. Set CORS_ORIGIN to your site only.');
  });
  await check('Browser "preflight" for saving data succeeds', async () => {
    const r = await get(`${API}/api/sales`, { method: 'OPTIONS', headers: { Origin: WEB, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type' } });
    if (!(r.status === 200 || r.status === 204) || r.headers.get('access-control-allow-origin') !== WEB) throw new Error(`Preflight failed (HTTP ${r.status}). Saving a sale would fail in the browser.`);
  });
  await check('API hides its technology and adds security headers', async () => {
    const h = (await get(`${API}/api/health`)).headers;
    if (h.get('x-powered-by')) throw new Error('x-powered-by header is exposed');
    if (h.get('x-content-type-options') !== 'nosniff') throw new Error('missing x-content-type-options');
  });
}

let html = '';
await check('Website loads', async () => {
  const r = await get(WEB); html = await r.text();
  if (r.status !== 200) throw new Error(`HTTP ${r.status}. Check the Vercel deployment and its Root Directory (must be "web").`);
  if (!html.includes('SettleNG')) throw new Error('The page does not look like SettleNG.');
});
await check('Public pages load; app routes redirect signed-out visitors to /login', async () => {
  const home = await get(`${WEB}/`); if (home.status !== 200) throw new Error(`/ returned HTTP ${home.status}`);
  const login = await get(`${WEB}/login`); if (login.status !== 200) throw new Error(`/login returned HTTP ${login.status}`);
  // The dashboard is behind auth: with redirect:'follow' we land on /login (200).
  const dash = await get(`${WEB}/dashboard`);
  if (dash.status !== 200 || !dash.url.includes('/login')) throw new Error(`/dashboard did not redirect a signed-out visitor to /login (status ${dash.status}, url ${dash.url}).`);
  const missing = await get(`${WEB}/definitely-not-a-page`); if (missing.status !== 404) throw new Error(`a bad link returned HTTP ${missing.status}, expected 404`);
});
await check('Website was built pointing at THIS API (NEXT_PUBLIC_API_URL)', async () => {
  const page = await (await get(`${WEB}/`)).text();
  const scripts = [...new Set([...page.matchAll(/\/_next\/static\/[^"'\s\\]+\.js/g)].map((m) => m[0]))].slice(0, 40);
  let hasApi = false, hasLocalhost = false;
  for (const s of scripts) {
    const js = await (await get(`${WEB}${s}`)).text();
    if (js.includes(API)) hasApi = true;
    if (!isLocal(API) && /localhost:4000/.test(js)) hasLocalhost = true;
    if (hasApi) break;
  }
  if (!hasApi) throw new Error(hasLocalhost
    ? 'The website was built with the local address (localhost:4000). On Vercel set NEXT_PUBLIC_API_URL to your API URL, then REDEPLOY (it is baked in at build time).'
    : `The website does not reference ${API}. Check NEXT_PUBLIC_API_URL on Vercel (no trailing slash, no /api) and redeploy.`);
});
await check('Website sends basic security headers', async () => {
  const h = (await get(WEB)).headers;
  if (h.get('x-content-type-options') !== 'nosniff') throw new Error('missing x-content-type-options');
  if (h.get('x-powered-by')) throw new Error('x-powered-by is exposed');
});

const failed = results.filter((r) => !r.ok);
console.log(failed.length
  ? `\n${failed.length} of ${results.length} checks failed. Fix the first ✗ above, redeploy that part, and run this again.\n`
  : `\nAll ${results.length} checks passed. Now open ${WEB} and click through it once on your phone.\n`);
process.exit(failed.length ? 1 : 0);
