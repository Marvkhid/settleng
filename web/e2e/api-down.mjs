// What users see when the API is unreachable, and whether Try again recovers.
// Run with the WEB app up and the API STOPPED (it starts the API itself part-way through): `npm run test:api-down`.
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
const B = process.env.BASE_URL ?? 'http://localhost:3000';
const browser = await puppeteer.launch({ args: [...chromium.args, '--no-sandbox'], executablePath: process.env.CHROME_PATH ?? (await chromium.executablePath()), headless: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const step = async (name, fn) => { try { await fn(); console.log('PASS', name); } catch (e) { console.log('FAIL', name, '\n    ', String(e.message).split('\n')[0]); process.exitCode = 1; } };
const text = (p) => p.evaluate(() => document.body.innerText);
const p = await browser.newPage(); await p.setViewport({ width: 1280, height: 900 });
const pageErrors = []; p.on('pageerror', (e) => pageErrors.push(e.message));

for (const [path, expect] of [['/dashboard', /couldn't load your dashboard/i], ['/customers', /can't reach the server/i], ['/invoices', /can't reach the server/i], ['/transactions', /can't reach the server/i], ['/reports', /couldn't load the report|can't reach|Something went wrong/i], ['/settings', /can't reach the server/i]]) {
  await step(`API down: ${path} shows a friendly error with Try again, no crash`, async () => {
    await p.goto(B + path, { waitUntil: 'networkidle0' });
    await p.waitForFunction((src) => new RegExp(src, 'i').test(document.body.innerText), { timeout: 15000 }, expect.source);
    const t = await text(p);
    assert.ok(!/TypeError|undefined|NaN|\[object/.test(t), 'raw error text leaked: ' + t.slice(0, 120));
    assert.ok(await p.evaluate(() => [...document.querySelectorAll('button')].some((b) => /Try again/.test(b.textContent))), 'no Try again button');
  });
}

await step('API down: saving a sale shows an error, never a fake success, and keeps the form open', async () => {
  await p.goto(B + '/customers', { waitUntil: 'networkidle0' });
  await p.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Record a sale') && b.offsetParent).click());
  await p.waitForSelector('#sale-amount'); await p.type('#sale-amount', '1000');
  await p.evaluate(() => document.querySelector('[role=dialog] button[type=submit]').click());
  await p.waitForFunction(() => /can't reach the server/i.test(document.body.innerText), { timeout: 10000 });
  assert.ok(!/Sale recorded/.test(await text(p)));
  assert.ok(await p.$('#sale-amount'), 'the form should stay open so nothing typed is lost');
  assert.equal(await p.$eval('#sale-amount', (e) => e.value), '1000');
  const btn = await p.$eval('[role=dialog] button[type=submit]', (b) => b.disabled);
  assert.equal(btn, false, 'Save button should be usable again for a retry');
  await p.keyboard.press('Escape');
});

await step('API comes back: Try again recovers without a full reload', async () => {
  const env = { ...process.env, PORT: '4000' };
  spawn('node', ['scripts/dev-local.mjs'], { cwd: new URL('../../api', import.meta.url).pathname, env, stdio: 'ignore', detached: true }).unref();
  for (let i = 0; i < 90; i++) { try { if ((await fetch('http://localhost:4000/api/health')).ok) break; } catch {} await sleep(2000); }
  await p.goto(B + '/dashboard', { waitUntil: 'networkidle0' }); // loads fine now
  await p.waitForSelector('#sales-today', { timeout: 15000 });
});

await step('recovery on the same page: server goes down mid-session, then Try again works', async () => {
  // Break the API URL for one request via interception, then let the retry through.
  await p.setRequestInterception(true);
  let fail = true;
  p.on('request', (r) => { if (fail && r.url().includes(':4000/api/customers')) r.abort('connectionrefused'); else r.continue(); });
  await p.goto(B + '/customers', { waitUntil: 'networkidle0' });
  await p.waitForFunction(() => /can't reach the server/i.test(document.body.innerText), { timeout: 10000 });
  fail = false;
  await p.evaluate(() => [...document.querySelectorAll('button')].find((b) => /Try again/.test(b.textContent)).click());
  await p.waitForFunction(() => /Folake|Chief Okafor|Mama Nkechi/.test(document.body.innerText), { timeout: 10000 });
});

console.log(pageErrors.length ? 'PAGE ERRORS: ' + pageErrors.join(' | ') : 'no uncaught page errors');
await browser.close();
