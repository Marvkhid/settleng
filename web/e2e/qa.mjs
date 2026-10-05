// Keyboard, loading, double-click, error and empty-state checks. Needs `npm run preview` running.
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
const B = process.env.BASE_URL ?? 'http://localhost:3000', API = process.env.API_URL ?? 'http://localhost:4000';
const browser = await puppeteer.launch({ args: [...chromium.args, '--no-sandbox'], executablePath: process.env.CHROME_PATH ?? (await chromium.executablePath()), headless: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const step = async (name, fn) => { try { await fn(); console.log('PASS', name); } catch (e) { console.log('FAIL', name, '\n    ', String(e.message).split('\n')[0]); process.exitCode = 1; } };
const j = (u) => fetch(API + u).then((r) => r.json());
const newPage = async (w = 1280, h = 900) => { const p = await browser.newPage(); await p.setViewport({ width: w, height: h }); return p; };
const bodyText = (p) => p.evaluate(() => document.body.innerText);

await step('keyboard: open a sheet with Enter, focus stays trapped inside, Escape closes and returns focus', async () => {
  const p = await newPage(); await p.goto(B + '/dashboard', { waitUntil: 'networkidle0' }); await p.waitForSelector('#sales-today');
  await p.evaluate(() => [...document.querySelectorAll('section[aria-label="Quick actions"] button')][0].focus());
  await p.keyboard.press('Enter'); await p.waitForSelector('[role=dialog]');
  for (let i = 0; i < 14; i++) { await p.keyboard.press('Tab'); assert.ok(await p.evaluate(() => !!document.activeElement.closest('[role=dialog]')), `focus escaped the dialog on tab ${i + 1}`); }
  const ring = await p.evaluate(() => { const e = document.activeElement; const cs = getComputedStyle(e); return cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 2; });
  assert.ok(ring, 'focused element has no visible focus ring');
  await p.keyboard.press('Escape'); await sleep(400);
  assert.equal(await p.$('[role=dialog]'), null);
  assert.match(await p.evaluate(() => document.activeElement?.textContent ?? ''), /Record a sale/, 'focus did not return to the trigger');
  await p.close();
});

await step('keyboard: a whole sale can be recorded without a mouse', async () => {
  const before = (await j('/api/transactions?pageSize=1')).total;
  const p = await newPage(); await p.goto(B + '/dashboard', { waitUntil: 'networkidle0' }); await p.waitForSelector('#sales-today');
  await p.evaluate(() => [...document.querySelectorAll('section[aria-label="Quick actions"] button')][0].focus());
  await p.keyboard.press('Enter'); await p.waitForSelector('#sale-amount');
  await p.keyboard.type('1500'); await p.keyboard.press('Enter');
  await p.waitForFunction(() => document.body.innerText.includes('Sale recorded'), { timeout: 10000 });
  assert.equal((await j('/api/transactions?pageSize=1')).total, before + 1);
  await p.close();
});

await step('errors are tied to their fields (aria-invalid + aria-describedby) and announced', async () => {
  const p = await newPage(); await p.goto(B + '/customers', { waitUntil: 'networkidle0' });
  await p.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Add customer') && b.offsetParent).click());
  await p.waitForSelector('#c-name'); await p.keyboard.press('Enter');
  await p.waitForSelector('#c-name-error');
  const info = await p.$eval('#c-name', (e) => ({ invalid: e.getAttribute('aria-invalid'), desc: e.getAttribute('aria-describedby') }));
  assert.equal(info.invalid, 'true'); assert.equal(info.desc, 'c-name-error');
  assert.equal(await p.$eval('#c-name-error', (e) => e.getAttribute('role')), 'alert');
  await p.close();
});

await step('loading: slow responses show skeletons marked busy, then real content', async () => {
  const p = await newPage(); await p.setRequestInterception(true);
  p.on('request', (r) => { if (r.url().includes(':4000/api/dashboard')) setTimeout(() => r.continue(), 1500); else r.continue(); });
  await p.goto(B + '/dashboard', { waitUntil: 'domcontentloaded' }); await sleep(700);
  assert.ok(await p.$('[aria-busy="true"]'), 'no loading skeleton while waiting');
  await p.waitForSelector('#sales-today', { timeout: 15000 });
  assert.equal(await p.$('[aria-busy="true"]'), null);
  await p.close();
});

await step('double-clicking Save records ONE sale, and the button shows it is working', async () => {
  const before = (await j('/api/transactions?pageSize=1')).total;
  const p = await newPage(); await p.setRequestInterception(true);
  let posts = 0;
  p.on('request', (r) => { if (r.method() === 'POST' && r.url().endsWith('/api/sales')) { posts++; setTimeout(() => r.continue(), 1200); } else r.continue(); });
  await p.goto(B + '/dashboard', { waitUntil: 'networkidle0' }); await p.waitForSelector('#sales-today');
  await p.evaluate(() => [...document.querySelectorAll('section[aria-label="Quick actions"] button')][0].click());
  await p.waitForSelector('#sale-amount'); await p.type('#sale-amount', '700');
  await p.evaluate(() => { const b = document.querySelector('[role=dialog] button[type=submit]'); b.click(); b.click(); });
  await sleep(300);
  const state = await p.$eval('[role=dialog] button[type=submit]', (b) => ({ busy: b.getAttribute('aria-busy'), disabled: b.disabled, text: b.textContent.trim() }));
  assert.equal(state.busy, 'true'); assert.equal(state.disabled, true); assert.match(state.text, /Saving/);
  await p.waitForFunction(() => document.body.innerText.includes('Sale recorded'), { timeout: 10000 });
  assert.equal(posts, 1, `sent ${posts} requests`);
  assert.equal((await j('/api/transactions?pageSize=1')).total, before + 1);
  await p.close();
});

await step('server rejection shows the server’s friendly message, never a fake success', async () => {
  const p = await newPage(); await p.goto(B + '/invoices/demo-inv-01', { waitUntil: 'networkidle0' });
  await p.waitForSelector('h1');
  const body = await bodyText(p);
  assert.match(body, /Paid/); assert.ok(!body.includes('Record payment'), 'a paid invoice should not offer Record payment');
  // try to overpay through the API-backed customer sheet: pay more than owed
  await p.goto(B + '/customers/demo-cust-05', { waitUntil: 'networkidle0' }); await p.waitForSelector('h1');
  await p.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Customer paid me'))?.click());
  await p.waitForSelector('#paid-amount'); await p.type('#paid-amount', '99999999');
  await p.evaluate(() => document.querySelector('[role=dialog] button[type=submit]').click());
  await p.waitForFunction(() => /only owes/.test(document.body.innerText), { timeout: 10000 });
  assert.ok(!/Payment recorded/.test(await bodyText(p)));
  await p.close();
});

await step('empty search result shows a helpful empty state', async () => {
  const p = await newPage(); await p.goto(B + '/customers', { waitUntil: 'networkidle0' });
  await p.type('input[type=search]', 'zzzznothing'); await p.waitForFunction(() => document.body.innerText.includes('No customers found'), { timeout: 8000 });
  await p.close();
});

await step('browser back/forward and refresh keep working on deep pages', async () => {
  const p = await newPage(); await p.goto(B + '/dashboard', { waitUntil: 'networkidle0' });
  await p.evaluate(() => [...document.querySelectorAll('a')].find((a) => a.textContent.includes('Folake') || a.href.includes('/customers/demo'))?.click());
  await p.waitForFunction(() => location.pathname.startsWith('/customers/'), { timeout: 8000 }); await p.waitForSelector('h1');
  await p.goBack(); await p.waitForSelector('#sales-today');
  await p.goForward(); await p.waitForSelector('h1'); await p.reload({ waitUntil: 'networkidle0' }); await p.waitForSelector('h1');
  assert.ok(!(await bodyText(p)).includes("couldn't find"));
  await p.close();
});

await browser.close();
