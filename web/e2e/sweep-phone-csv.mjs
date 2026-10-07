// Phone layout (bottom bar, + actions, More sheet, no sideways scroll), the CSV matching screen end to end, and a check that every sample 'Possible match' can be confirmed.
// Needs `npm run preview` running. It resets the demo data when it finishes.
import { launch, newPage, step, go, text, waitText, clickText, toast, j, assert, sleep, bad, results } from './sweep-helpers.mjs';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
const browser = await launch();
let cur = await newPage(browser, 1280, 900);
const p = new Proxy({}, { get: (_, k) => { const v = cur[k]; return typeof v === 'function' ? v.bind(cur) : v; } });
const stepM = (name, fn, size = [390, 844]) => step(name, async () => {
  for (let attempt = 0; ; attempt++) {
    try { await cur.close().catch(() => {}); cur = await newPage(browser, ...size); await fn(); return; }
    catch (e) { if (attempt === 0 && /detached|Execution context|Target closed|Session closed/i.test(String(e.message))) { console.log('   (tab died, retrying once)'); continue; } throw e; }
  }
}, p);
const D = [1280, 900];
const yesterday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos' }).format(new Date(Date.now() - 86400000));

await stepM('demo data: every sample "Possible match" can actually be confirmed (no dead-end buttons)', async () => {
  await j('/api/demo/reset', { method: 'POST' });
  const imports = (await j('/api/reconciliation/imports')).body.items; const failures = []; let tried = 0;
  for (const imp of imports) {
    const detail = (await j(`/api/reconciliation/imports/${imp.id}`)).body;
    for (const row of detail.rows.filter((r) => r.status === 'SUGGESTED_MATCH')) {
      tried++; const r = await j(`/api/reconciliation/rows/${row.id}/confirm`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
      if (r.status !== 200) failures.push(`${imp.filename} row ${row.rowNumber} -> ${row.suggestedInvoice.invoiceNumber}: ${r.body?.message}`);
    }
  }
  console.log(`   tried ${tried} seeded suggestions; ${failures.length} failed`); failures.forEach((f) => console.log('     ', f));
  await j('/api/demo/reset', { method: 'POST' });
  assert.equal(failures.length, 0, `${failures.length} sample suggestions cannot be confirmed`);
}, D);

await stepM('csv screen: upload, preview, import, reject a suggestion, match it by hand, history opens', async () => {
  const inv = (await j('/api/invoices?status=UNPAID&pageSize=100')).body.items.find((i) => i.issueDate <= yesterday);
  const csv = ['Date,Description,Amount,Direction,Reference', `${yesterday},Transfer ${inv.invoiceNumber},${inv.balance},credit,SWEEP-1`, `${yesterday},Mystery deposit,1234,credit,SWEEP-2`, 'bad date,Broken,10,credit,SWEEP-3'].join('\n');
  const file = path.join(os.tmpdir(), 'sweep-statement.csv'); fs.writeFileSync(file, csv);
  await go(p, '/reconciliation'); await waitText(p, /Your uploads/); await waitText(p, /has not checked them with any bank/);
  assert.ok((await p.$$('main section ul li')).length >= 3, 'seeded upload history should list 3 uploads');
  await (await p.waitForSelector('#csv-file')).uploadFile(file); await waitText(p, /Possible match/);
  await clickText(p, 'button', 'Import 3 rows'); await toast(p, 'Imported 3 rows'); await waitText(p, /This might be a payment for/);
  await clickText(p, 'button', 'Not this one'); await toast(p, 'Suggestion dismissed'); await waitText(p, /No match yet/);
  assert.equal((await j(`/api/invoices/${inv.id}`)).body.balance, inv.balance);
  const matchButtons = await p.$$eval('button', (b) => b.filter((x) => x.textContent.includes('Match to an invoice')).length); assert.ok(matchButtons >= 2);
  await p.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Match to an invoice')).click());
  await p.waitForSelector('[role=dialog]'); await waitText(p, /Which invoice was it for/);
  await clickText(p, '[role=dialog] button', inv.invoiceNumber); await p.waitForFunction(() => [...document.querySelectorAll('[role=dialog]')].some((d) => d.innerText.includes('Record this payment')), {});
  await clickText(p, '[role=dialog] button', 'Yes, record it'); await toast(p, 'Payment recorded and matched'); await waitText(p, /Matched to/);
  assert.equal((await j(`/api/invoices/${inv.id}`)).body.status, 'PAID');
  await clickText(p, 'button', 'All uploads'); await waitText(p, /to review|All reviewed/);
  await p.evaluate(() => document.querySelector('main section ul li button').click()); await waitText(p, /These rows come from a file/);
}, D);

await stepM('seeded import opens and the unreadable / duplicate rows explain themselves', async () => {
  await go(p, '/reconciliation?import=demo-import-3'); await waitText(p, /bank-export-october/);
  const t = await text(p); for (const s of ["Can't read", 'Duplicate', 'Possible match', 'No match yet', 'Money out']) assert.ok(t.includes(s), 'missing badge: ' + s);
  await go(p, '/reconciliation?import=nope'); await waitText(p, /couldn't find that upload/);
}, D);

await stepM('PHONE dashboard: figures visible, + opens quick actions and a sale saves', async () => {
  await go(p, '/dashboard'); await p.waitForSelector('#sales-today');
  const before = await p.$eval('#sales-today', (e) => e.closest('section').querySelector('p').textContent);
  await p.click('button[aria-label^="Record a sale, expense"]'); await p.waitForSelector('[role=dialog]'); await clickText(p, '[role=dialog] button', 'Record a sale');
  await p.waitForSelector('#sale-amount'); await p.type('#sale-amount', '2500'); await clickText(p, '[role=dialog] button[type=submit]', 'Save sale'); await toast(p, 'Sale recorded');
  await p.waitForFunction((b) => document.querySelector('#sales-today').closest('section').querySelector('p').textContent !== b, { timeout: 15000 }, before);
  await p.click('button[aria-label^="Record a sale, expense"]'); await clickText(p, '[role=dialog] button', 'Record an expense'); await p.waitForSelector('#exp-amount');
  await p.type('#exp-amount', '900'); await clickText(p, '[role=dialog] label', 'Utilities'); await clickText(p, '[role=dialog] button[type=submit]', 'Save expense'); await toast(p, 'Expense saved');
  await p.click('button[aria-label^="Record a sale, expense"]'); await clickText(p, '[role=dialog] button', 'Customer paid me'); await p.waitForSelector('#paid-customer'); await p.keyboard.press('Escape');
});

await stepM('PHONE navigation: bottom bar tabs and the More sheet reach every screen', async () => {
  await go(p, '/dashboard'); await p.waitForSelector('#sales-today');
  for (const [tab, path] of [['Customers', '/customers'], ['Invoices', '/invoices'], ['Home', '/dashboard']]) {
    await p.evaluate((t) => [...document.querySelectorAll('nav[aria-label=Main] a')].find((a) => a.textContent.trim() === t).click(), tab);
    await p.waitForFunction((pa) => location.pathname === pa, {}, path); await p.waitForSelector('h1');
  }
  for (const [label, re] of [['Sales', /Sales and money in/], ['Expenses', /Expenses and money out/], ['Reports', /Business summary/], ['Match records', /Match records/], ['Settings', /^Settings$/]]) {
    await clickText(p, 'nav[aria-label=Main] button', 'More'); await p.waitForSelector('[role=dialog]'); await clickText(p, '[role=dialog] a', label);
    await p.waitForFunction((src) => new RegExp(src).test(document.querySelector('h1')?.textContent ?? ''), {}, re.source); await p.waitForFunction(() => !document.querySelector('[role=dialog]'));
  }
});

await stepM('PHONE: no sideways scrolling and the forms fit at 360px on every main screen', async () => {
  await cur.setViewport({ width: 360, height: 740 });
  for (const path of ['/', '/dashboard', '/customers', '/customers/demo-cust-01', '/invoices', '/invoices/new', '/invoices/demo-inv-08', '/invoices/demo-inv-08/edit', '/transactions', '/transactions/new', '/reports', '/reconciliation', '/settings']) {
    await go(p, path); await sleep(400);
    const o = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth })); assert.ok(o.sw <= o.iw + 1, `${path} scrolls sideways (${o.sw} > ${o.iw})`);
  }
});

await stepM('PHONE: create an invoice with two items end to end', async () => {
  await go(p, '/invoices/new'); await p.waitForFunction(() => document.querySelectorAll('#i-customer option').length > 3);
  await p.select('#i-customer', 'demo-cust-07'); await p.type('#item-0-d', 'Phone invoice A'); await p.type('#item-0-p', '1000');
  await clickText(p, 'button', 'Add another item'); await p.waitForSelector('#item-1-d'); await p.type('#item-1-d', 'Phone invoice B'); await p.type('#item-1-p', '2,500.50');
  await waitText(p, /₦3,500\.50/); await clickText(p, 'button', 'Create invoice'); await toast(p, 'Invoice created'); await waitText(p, /Phone invoice B/);
  await clickText(p, 'button', 'Record payment'); await p.waitForSelector('#p-amount'); await clickText(p, '[role=dialog] button', "Everything that's left"); await clickText(p, '[role=dialog] button[type=submit]', 'Save payment'); await toast(p, 'Payment recorded'); await waitText(p, /Paid/);
});

await stepM('landing on a phone: Explore Demo is reachable and works', async () => {
  await go(p, '/'); await clickText(p, 'a', 'Explore Demo'); await p.waitForSelector('#sales-today');
});

await stepM('final reset leaves the demo exactly as it started', async () => {
  await j('/api/demo/reset', { method: 'POST' });
  assert.equal((await j('/api/customers?pageSize=100')).body.total, 12); assert.equal((await j('/api/invoices?pageSize=100')).body.total, 25);
  assert.equal((await j('/api/reconciliation/imports')).body.items.length, 3);
}, D);

const unexpected = bad.filter((b) => !/\/nope|POST \/api\/invoices\/.*\/payments|\/rows\/.*\/confirm/.test(b));
console.log(`\n${results.pass} passed, ${results.fail} failed`);
console.log(unexpected.length ? 'Unexpected API errors / page errors:\n  ' + [...new Set(unexpected)].join('\n  ') : 'No unexpected API errors or page errors.');
await browser.close();
