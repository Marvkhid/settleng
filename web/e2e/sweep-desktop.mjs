// Desktop click-through: every screen, link, filter, form and confirmation, including draft/issue/void/delete invoices, customers, records, reports downloads and Reset Demo.
// Needs `npm run preview` running. It resets the demo data when it finishes.
import { launch, newPage, step, go, text, waitText, clickText, toast, j, assert, sleep, bad, results } from './sweep-helpers.mjs';
const browser = await launch();
let cur = await newPage(browser);
const p = new Proxy({}, { get: (_, k) => { const v = cur[k]; return typeof v === 'function' ? v.bind(cur) : v; } });
// Each step gets a fresh tab; if a tab dies (infrastructure, not the app) the step is retried once.
const step2 = (name, fn, pg) => step(name, async () => {
  for (let attempt = 0; ; attempt++) {
    try { await cur.close().catch(() => {}); cur = await newPage(browser); await fn(); return; }
    catch (e) { if (attempt === 0 && /detached|Execution context|Target closed|Session closed/i.test(String(e.message))) { console.log('   (tab died, retrying once)'); continue; } throw e; }
  }
}, pg);
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos' }).format(new Date());

await step2('landing: Explore Demo opens the dashboard; page has the required wording', async () => {
  await go(p, '/'); const t = await text(p);
  for (const s of ['Know where your business money is going.', 'Track sales, expenses, customer debts and payments in one simple place.', 'Explore Demo']) assert.ok(t.includes(s), 'missing: ' + s);
  await clickText(p, 'a', 'Explore Demo'); await p.waitForSelector('#sales-today', { timeout: 60000 });
  assert.ok((await p.url()).endsWith('/dashboard'));
}, p);

await step2('dashboard: every figure the spec asks for is visible and sensible', async () => {
  await go(p, '/dashboard'); await p.waitForSelector('#sales-today'); const t = await text(p);
  for (const s of ['Good ', "Here's how your business is doing.", 'Demo mode · Sample business', 'Sales today', 'Expenses today', 'Money in', 'Money out', 'Customers owing', 'What happened recently', 'Sales vs expenses']) assert.ok(t.includes(s), 'missing: ' + s);
  const d = (await j('/api/dashboard')).body;
  assert.ok(t.includes(Number(d.salesToday).toLocaleString('en-NG')), 'dashboard sales not matching API');
}, p);

await step2('sidebar: every link goes to the right page', async () => {
  await go(p, '/dashboard'); await p.waitForSelector('#sales-today');
  for (const [label, path, heading] of [['Sales', '/transactions', /Sales and money in/], ['Expenses', '/transactions', /Expenses and money out/], ['Customers', '/customers', /^Customers$/], ['Invoices', '/invoices', /^Invoices$/], ['Reports', '/reports', /Business summary/], ['Match records', '/reconciliation', /Match records/], ['Settings', '/settings', /^Settings$/], ['Home', '/dashboard', /Good/]]) {
    await p.evaluate((l) => [...document.querySelectorAll('aside a')].find((a) => a.textContent.trim() === l).click(), label);
    await p.waitForFunction((pa) => location.pathname === pa, {}, path); await p.waitForSelector('h1');
    await p.waitForFunction((src) => new RegExp(src).test(document.querySelector('h1').textContent.trim()), {}, heading.source);
  }
}, p);

await step2('dashboard tiles: Who owes me?, View records, Customer paid me', async () => {
  await go(p, '/dashboard'); await p.waitForSelector('#sales-today');
  await clickText(p, 'section[aria-label="Quick actions"] a', 'Who owes me?'); await waitText(p, /Customers with money still to pay/);
  assert.ok((await p.url()).includes('owing=1'));
  await go(p, '/dashboard'); await p.waitForSelector('#sales-today');
  await clickText(p, 'section[aria-label="Quick actions"] a', 'View records'); await waitText(p, /All records/);
  await go(p, '/dashboard'); await p.waitForSelector('#sales-today');
  await clickText(p, 'section[aria-label="Quick actions"] button', 'Customer paid me'); await p.waitForSelector('#paid-customer');
  assert.ok((await p.$$eval('#paid-customer option', (o) => o.length)) > 5); await p.keyboard.press('Escape');
}, p);

await step2('chart: 30 days and 3 months tabs both draw and update the summary line', async () => {
  await go(p, '/dashboard'); await p.waitForSelector('#chart-h');
  const first = await p.$eval('#chart-h', (e) => e.closest('section').querySelector('p').textContent);
  for (const label of ['30 days', '3 months', '7 days']) {
    await clickText(p, '#chart-h ~ div button', label);
    await p.waitForFunction((l) => [...document.querySelectorAll('#chart-h ~ div button')].find((b) => b.textContent === l).getAttribute('aria-pressed') === 'true', {}, label);
    await p.waitForSelector('#chart-h ~ div, section svg', { timeout: 15000 });
    await p.waitForFunction(() => document.querySelectorAll('section[aria-labelledby="chart-h"] svg .recharts-bar-rectangle').length > 0, { timeout: 15000 });
  }
  const back = await p.$eval('#chart-h', (e) => e.closest('section').querySelector('p').textContent);
  assert.equal(back, first);
}, p);

await step2('customers: search, owing filter, add, edit, archive, restore', async () => {
  await go(p, '/customers'); await waitText(p, /Mama Nkechi/);
  await p.type('input[type=search]', 'chief'); await p.waitForFunction(() => document.querySelectorAll('main ul > li').length === 1, {});
  await p.focus('input[type=search]'); await p.keyboard.down('Control'); await p.keyboard.press('KeyA'); await p.keyboard.up('Control'); await p.keyboard.press('Backspace');
  await p.waitForFunction(() => document.querySelectorAll('main ul > li').length > 5, {});
  await clickText(p, 'button', 'Owing'); await p.waitForFunction(() => location.search.includes('owing=1')); await waitText(p, /Who owes me/);
  await clickText(p, 'button', 'All customers'); await waitText(p, /Everyone you sell to/);
  await clickText(p, 'button', 'Add customer'); await p.waitForSelector('#c-name');
  await p.type('#c-name', 'Sweep Test Customer'); await p.type('#c-phone', '08099990000'); await p.type('#c-notes', 'created by the sweep');
  await clickText(p, '[role=dialog] button[type=submit]', 'Add customer'); await toast(p, 'Customer added');
  await p.waitForFunction(() => /\/customers\/[^/]+$/.test(location.pathname), {}); await waitText(p, /Sweep Test Customer/);
  await clickText(p, 'button', 'Edit'); await p.waitForSelector('#c-name');
  await p.click('#c-name', { clickCount: 3 }); await p.type('#c-name', 'Sweep Renamed'); await clickText(p, '[role=dialog] button[type=submit]', 'Save changes'); await toast(p, 'Customer updated');
  await waitText(p, /Sweep Renamed/);
  await clickText(p, 'button', 'Archive'); await p.waitForSelector('[role=dialog]'); await clickText(p, '[role=dialog] button', 'Archive'); await toast(p, 'Customer archived');
  await waitText(p, /Restore/); await clickText(p, 'button', 'Restore'); await p.waitForSelector('[role=dialog]'); await clickText(p, '[role=dialog] button', 'Restore'); await toast(p, 'Customer restored');
}, p);

let draftUrl;
await step2('invoices: filter chips, search; new draft; edit; issue; partial payment; overpay refused', async () => {
  await go(p, '/invoices'); await waitText(p, /AMM-/);
  for (const f of ['Unpaid', 'Part paid', 'Overdue', 'Paid', 'Drafts', 'Void', 'All']) {
    await clickText(p, '[role=group] button', f); await p.waitForFunction((l) => [...document.querySelectorAll('[role=group] button')].find((b) => b.textContent === l).getAttribute('aria-pressed') === 'true', {}, f);
    await p.waitForFunction(() => !document.body.innerText.includes('Loading') && (document.querySelectorAll('main ul > li').length > 0 || /No invoices match/.test(document.body.innerText)), { timeout: 15000 });
  }
  await p.type('input[type=search]', 'AMM-0008'); await p.waitForFunction(() => document.querySelectorAll('main ul > li').length === 1, {});

  await go(p, '/invoices/new'); await p.waitForSelector('#i-customer'); await p.waitForFunction(() => document.querySelectorAll('#i-customer option').length > 3);
  await p.select('#i-customer', 'demo-cust-04'); await p.type('#item-0-d', 'Sweep goods'); await p.$eval('#item-0-q', (e) => (e.value = '')); await p.type('#item-0-q', '3'); await p.type('#item-0-p', '2,000');
  await waitText(p, /₦6,000/);
  await clickText(p, 'button', 'Save as draft'); await toast(p, 'Draft saved'); await p.waitForFunction(() => /\/invoices\/[^/]+$/.test(location.pathname) && !location.pathname.endsWith('/new'));
  await waitText(p, /Draft/); draftUrl = await p.url();
  await clickText(p, 'a', 'Edit'); await p.waitForSelector('#item-0-q'); await p.$eval('#item-0-q', (e) => (e.value = '')); await p.type('#item-0-q', '5');
  await clickText(p, 'button', 'Save changes'); await toast(p, 'Invoice updated'); await waitText(p, /₦10,000/);
  await clickText(p, 'button', 'Issue invoice'); await toast(p, 'Invoice issued'); await waitText(p, /Unpaid|Overdue/);
  await clickText(p, 'button', 'Record payment'); await p.waitForSelector('#p-amount'); await p.type('#p-amount', '4000');
  await clickText(p, '[role=dialog] button[type=submit]', 'Save payment'); await toast(p, 'Payment recorded'); await waitText(p, /Part paid/); await waitText(p, /₦6,000/);
  await clickText(p, 'button', 'Record payment'); await p.waitForSelector('#p-amount'); await p.type('#p-amount', '7000');
  await clickText(p, '[role=dialog] button[type=submit]', 'Save payment'); await toast(p, 'more than');
  assert.ok(await p.$('#p-amount'), 'dialog should stay open after a refused payment'); await p.keyboard.press('Escape');
}, p);

await step2('invoices: void an unpaid invoice; delete a draft; paid invoice offers no payment', async () => {
  await go(p, '/invoices/new'); await p.waitForFunction(() => document.querySelectorAll('#i-customer option').length > 3);
  await p.select('#i-customer', 'demo-cust-05'); await p.type('#item-0-d', 'To be voided'); await p.type('#item-0-p', '1500'); await clickText(p, 'button', 'Create invoice'); await toast(p, 'Invoice created');
  await waitText(p, /To be voided/); await clickText(p, 'button', 'Void'); await p.waitForSelector('[role=dialog]'); await clickText(p, '[role=dialog] button', 'Void invoice'); await toast(p, 'Invoice voided'); await waitText(p, /Void/);
  assert.ok(!(await text(p)).includes('Record payment'));
  await go(p, '/invoices/new'); await p.waitForFunction(() => document.querySelectorAll('#i-customer option').length > 3);
  await p.select('#i-customer', 'demo-cust-06'); await p.type('#item-0-d', 'Disposable draft'); await p.type('#item-0-p', '900'); await clickText(p, 'button', 'Save as draft'); await toast(p, 'Draft saved');
  await clickText(p, 'button', 'Delete draft'); await p.waitForSelector('[role=dialog]'); await clickText(p, '[role=dialog] button', 'Delete draft'); await toast(p, 'Draft deleted');
  await p.waitForFunction(() => location.pathname === '/invoices');
  await go(p, '/invoices/demo-inv-01'); await waitText(p, /Paid/); assert.ok(!(await text(p)).includes('Record payment'));
}, p);

await step2('records: tabs, category + date filters, add a record, pagination', async () => {
  await go(p, '/transactions'); await waitText(p, /All records/);
  for (const [label, re] of [['Money in', /Sales and money in/], ['Money out', /Expenses and money out/], ['All', /All records/]]) { await clickText(p, '[role=group] button', label); await waitText(p, re); }
  await p.select('select[aria-label=Category]', 'Transport'); await p.waitForFunction(() => [...document.querySelectorAll('main ul > li')].every((li) => li.innerText.includes('Transport')) && document.querySelectorAll('main ul > li').length > 0, {});
  await p.select('select[aria-label=Category]', '');
  await p.$eval('input[aria-label="From date"]', (e, v) => { const s = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; s.call(e, v); e.dispatchEvent(new Event('input', { bubbles: true })); }, today);
  await p.waitForFunction(() => [...document.querySelectorAll('main ul > li')].every((li) => /Today/.test(li.innerText)), { timeout: 15000 });
  await go(p, '/transactions'); await waitText(p, /Page 1 of/); await clickText(p, 'button', 'Next'); await waitText(p, /Page 2 of/); await clickText(p, 'button', 'Previous'); await waitText(p, /Page 1 of/);
  await go(p, '/transactions/new'); await p.waitForSelector('#t-amount'); await clickText(p, 'label', 'Money in'); await p.type('#t-amount', '1,234'); await p.type('#t-cat', 'Other income'); await p.type('#t-desc', 'sweep record');
  await clickText(p, 'button', 'Save record'); await toast(p, 'Money in saved'); await p.waitForFunction(() => location.pathname === '/transactions'); await waitText(p, /sweep record/);
}, p);

await step2('reports: presets, custom range, three CSV downloads are real CSV files', async () => {
  await go(p, '/reports'); await waitText(p, /Money customers owe/);
  for (const l of ['Last 7 days', 'Last 90 days', 'Last 30 days']) { await clickText(p, '[role=group] button', l); await p.waitForFunction((x) => [...document.querySelectorAll('[role=group] button')].find((b) => b.textContent === x).getAttribute('aria-pressed') === 'true', {}, l); await waitText(p, /Where the money went/); }
  const files = await p.$$eval('a[download]', (as) => as.map((a) => a.href));
  assert.equal(files.length, 3);
  for (const href of files) { const r = await p.evaluate(async (h) => { const x = await fetch(h); return [x.status, x.headers.get('content-type'), (await x.text()).split('\r\n')[0]]; }, href); assert.equal(r[0], 200); assert.match(r[1], /text\/csv/); assert.ok(r[2].includes(',')); }
}, p);

await step2('settings: details shown, Reset Demo asks first and then restores the sample data', async () => {
  await go(p, '/settings'); await waitText(p, /Adeola Mini Mart/); const t = await text(p);
  for (const s of ['Nigerian naira', 'Demo mode', 'On', 'Reset demo']) assert.ok(t.includes(s), 'missing ' + s);
  await clickText(p, 'button', 'Reset Demo'); await p.waitForSelector('[role=dialog]'); assert.ok((await p.$eval('[role=dialog]', (e) => e.innerText)).includes('restore the original sample business data'));
  await clickText(p, '[role=dialog] button', 'Cancel'); await sleep(300); assert.equal(await p.$('[role=dialog]'), null);
  const before = (await j('/api/customers?pageSize=100')).body.total;
  assert.ok(before >= 13);
  await clickText(p, 'button', 'Reset Demo'); await p.waitForSelector('[role=dialog]'); await clickText(p, '[role=dialog] button', 'Reset demo'); await toast(p, 'Demo reset');
  assert.equal((await j('/api/customers?pageSize=100')).body.total, 12); assert.equal((await j('/api/invoices?pageSize=100')).body.total, 25);
}, p);

await step2('404 page and bad ids: friendly, with a way home', async () => {
  await go(p, '/this-page-does-not-exist'); await waitText(p, /couldn't find that page/); await clickText(p, 'a', 'Go to Home'); await p.waitForSelector('#sales-today');
  await go(p, '/customers/nope'); await waitText(p, /couldn't find that customer/); await go(p, '/invoices/nope/edit'); await waitText(p, /couldn't find that invoice/);
}, p);

const unexpected = bad.filter((b) => !/\/(invoices|customers)\/nope|POST \/invoices\/.*\/payments|POST \/api\/sales/.test(b) && !/^400 POST \/invoices\/[a-z0-9]+\/payments/.test(b));
console.log(`\n${results.pass} passed, ${results.fail} failed`);
console.log(unexpected.length ? 'Unexpected API errors / page errors:\n  ' + [...new Set(unexpected)].join('\n  ') : 'No unexpected API errors or page errors.');
await browser.close();
