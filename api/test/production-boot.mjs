// Boots the BUILT API in production mode against a throwaway real Postgres and probes it the way the internet will.
// Run:  npm run test:prod-boot   (builds first)
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
const API_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pgChild = spawn(process.execPath, [path.join(API_ROOT, 'test/support/start-pg.mjs')], { stdio: ['ignore', 'pipe', 'inherit'] });
const dbUrl = await new Promise((res, rej) => { const t = setTimeout(() => rej(new Error('pg timeout')), 90000); pgChild.stdout.on('data', (b) => { const m = /READY (\S+)/.exec(b.toString()); if (m) { clearTimeout(t); res(m[1]); } }); });
const results = []; const check = async (n, f) => { try { await f(); results.push(['PASS', n]); } catch (e) { results.push(['FAIL', n + '\n      ' + String(e.message).split('\n')[0]]); } };
const boot = (env, port) => { const c = spawn(process.execPath, ['dist/main.js'], { cwd: API_ROOT, env: { ...process.env, DATABASE_URL: '', CORS_ORIGIN: '', DATABASE_SSL: '', PORT: String(port), ...env }, stdio: ['ignore', 'pipe', 'pipe'] }); c.out = ''; c.stdout.on('data', (d) => (c.out += d)); c.stderr.on('data', (d) => (c.out += d)); return c; };
const waitUp = async (port, ms = 20000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if ((await fetch(`http://localhost:${port}/api/health`)).ok) return true; } catch {} await sleep(300); } return false; };
const A = 'http://localhost:4100';

await check('production refuses to start without DATABASE_URL / CORS_ORIGIN, and says what to set', async () => {
  const c = boot({ NODE_ENV: 'production' }, 4199); const code = await new Promise((r) => c.on('exit', r));
  assert.notEqual(code, 0); assert.match(c.out, /DATABASE_URL/); assert.match(c.out, /CORS_ORIGIN/);
});
await check('production refuses a wildcard CORS origin', async () => {
  const c = boot({ NODE_ENV: 'production', DATABASE_URL: dbUrl, CORS_ORIGIN: '*' }, 4198); const code = await new Promise((r) => c.on('exit', r));
  assert.notEqual(code, 0); assert.match(c.out, /not "\*"/);
});

const api = boot({ NODE_ENV: 'production', DATABASE_URL: dbUrl, CORS_ORIGIN: 'https://settleng.vercel.app,https://settleng-*.vercel.app', DEMO_MODE: 'true' }, 4100);
assert.ok(await waitUp(4100), 'API did not start:\n' + api.out);
const j = (p, init) => fetch(A + p, init).then(async (r) => ({ status: r.status, headers: r.headers, body: await r.json().catch(() => null) }));

await check('liveness answers; readiness says database up but sample data missing (migrated, not seeded)', async () => {
  assert.equal((await j('/api/health')).status, 200);
  const r = await j('/api/health/ready'); assert.equal(r.status, 200); assert.deepEqual(r.body, { status: 'ok', database: 'up', sampleData: 'missing' });
});
await check('Reset Demo loads the sample business into the freshly migrated database; readiness flips to loaded', async () => {
  assert.equal((await j('/api/demo/reset', { method: 'POST' })).status, 200);
  assert.equal((await j('/api/health/ready')).body.sampleData, 'loaded');
  assert.equal((await j('/api/customers?pageSize=100')).body.total, 12);
  assert.ok(Number((await j('/api/dashboard')).body.customersOwing.total) > 0);
});
await check('security headers: no x-powered-by, nosniff', async () => {
  const h = (await j('/api/health')).headers; assert.equal(h.get('x-powered-by'), null); assert.equal(h.get('x-content-type-options'), 'nosniff');
});
await check('CORS: your site and its Vercel previews are allowed; other sites are not', async () => {
  const acao = async (o) => (await j('/api/health', { headers: { Origin: o } })).headers.get('access-control-allow-origin');
  assert.equal(await acao('https://settleng.vercel.app'), 'https://settleng.vercel.app');
  assert.equal(await acao('https://settleng-git-main-marvel.vercel.app'), 'https://settleng-git-main-marvel.vercel.app');
  for (const bad of ['https://evil.com', 'https://settleng.vercel.app.evil.com', 'http://settleng.vercel.app']) assert.equal(await acao(bad), null, bad);
});
await check('CORS preflight for a save from the website succeeds', async () => {
  const r = await fetch(A + '/api/sales', { method: 'OPTIONS', headers: { Origin: 'https://settleng.vercel.app', 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type' } });
  assert.ok(r.status === 204 || r.status === 200); assert.equal(r.headers.get('access-control-allow-origin'), 'https://settleng.vercel.app'); assert.match(r.headers.get('access-control-allow-methods') ?? '', /POST/);
});
await check('behind a proxy, rate limits are per visitor (trust proxy): different X-Forwarded-For are counted separately', async () => {
  const codes = []; for (const ip of ['10.0.0.1', '10.0.0.2', '10.0.0.3', '10.0.0.4', '10.0.0.5']) codes.push((await j('/api/demo/reset', { method: 'POST', headers: { 'X-Forwarded-For': ip } })).status);
  assert.ok(codes.every((c) => c === 200), 'distinct visitors were wrongly throttled together: ' + codes);
  const same = []; for (let i = 0; i < 5; i++) same.push((await j('/api/demo/reset', { method: 'POST', headers: { 'X-Forwarded-For': '10.9.9.9' } })).status);
  assert.ok(same.includes(429), 'the same visitor was never throttled: ' + same);
});
await check('Swagger docs still load with the security headers on', async () => { assert.equal((await fetch(A + '/api/docs')).status, 200); });
await check('error responses stay friendly and never leak internals', async () => {
  const r = await j('/api/customers/does-not-exist'); assert.equal(r.status, 404); assert.ok(!JSON.stringify(r.body).match(/prisma|stack|node_modules/i));
});
api.kill('SIGTERM');

await check('database unreachable: API stays up (liveness), readiness answers 503 with a plain message', async () => {
  const bad = dbUrl.replace(/:\d+\//, ':1/');
  const c = boot({ NODE_ENV: 'production', DATABASE_URL: bad, CORS_ORIGIN: 'https://settleng.vercel.app' }, 4101);
  const up = await waitUp(4101, 15000);
  if (!up) { await sleep(500); throw new Error('API did not stay up with an unreachable database. Output: ' + c.out.slice(0, 300)); }
  const r = await (await fetch('http://localhost:4101/api/health/ready')).json(); const s = (await fetch('http://localhost:4101/api/health/ready')).status;
  assert.equal(s, 503); assert.match(r.message, /not reachable/i); c.kill('SIGTERM');
});

pgChild.kill('SIGTERM');
for (const [s, n] of results) console.log(s, n);
console.log(results.some((r) => r[0] === 'FAIL') ? '\nSOME CHECKS FAILED' : '\nAll production-boot checks passed.');
process.exit(0);
