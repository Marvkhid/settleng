// Browser flow test for the real UI. Needs the app running: from the repo root run `npm run preview`,
// then in another terminal: `npm run test:e2e --prefix web`.
// Uses your own Chrome if CHROME_PATH is set, otherwise a bundled Chromium.
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const B = process.env.BASE_URL ?? 'http://localhost:3000';
const browser = await puppeteer.launch({ args: [...chromium.args, '--no-sandbox'], executablePath: process.env.CHROME_PATH ?? (await chromium.executablePath()), headless: true });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 900 });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const step = async (name, fn) => { try { await fn(); console.log('PASS', name); } catch (e) { console.log('FAIL', name, '\n    ', String(e.message).split('\n')[0]); await page.screenshot({ path: `./e2e-failure-${name.replace(/\W+/g, '-')}.png` }); process.exitCode = 1; } };
const clickText = async (selector, text) => {
  await page.waitForFunction((s, t) => [...document.querySelectorAll(s)].some((e) => e.textContent.trim().includes(t) && !e.disabled), { timeout: 15000 }, selector, text);
  await page.evaluate((s, t) => [...document.querySelectorAll(s)].find((e) => e.textContent.trim().includes(t) && !e.disabled).click(), selector, text);
};
const bodyText = () => page.evaluate(() => document.body.innerText);
const money = (s) => Number(s.replace(/[₦,]/g, ''));
const hero = async () => {
  await page.waitForSelector('#sales-today');
  return page.evaluate(() => {
    const t = (sel) => document.querySelector(sel)?.textContent ?? '';
    const sec = document.querySelector('section[aria-labelledby="sales-today"]');
    const dds = [...sec.querySelectorAll('dd')].map((d) => d.textContent);
    const owing = document.querySelector('section[aria-labelledby="owing-h"] p')?.textContent;
    return { sales: sec.querySelector('p').textContent, spent: dds[0], moneyIn: dds[1], moneyOut: dds[2], owing };
  });
};
const toast = async (text) => page.waitForFunction((t) => document.body.innerText.includes(t), { timeout: 15000 }, text);
const goDashboard = async () => { await page.goto(B + '/dashboard', { waitUntil: 'networkidle0' }); await page.waitForSelector('#sales-today'); };

// start from a clean demo
await page.goto(B + '/settings', { waitUntil: 'networkidle0' });
await clickText('button', 'Reset Demo'); await page.waitForSelector('[role=dialog] button.bg-red');
await clickText('[role=dialog] button', 'Reset demo'); await toast('Demo reset');

let base;
await step('dashboard shows real numbers', async () => {
  await goDashboard(); base = await hero();
  assert.ok(money(base.sales) > 0, 'sales today should be above zero: ' + base.sales);
  assert.match(await bodyText(), /Demo mode · Sample business/);
});

await step('record a cash sale of 3,000 updates sales and money in by exactly 3,000', async () => {
  await clickText('section[aria-label="Quick actions"] button', 'Record a sale');
  await page.waitForSelector('#sale-amount'); await page.type('#sale-amount', '3,000');
  await clickText('[role=dialog] button[type=submit]', 'Save sale'); await toast('Sale recorded');
  await page.waitForFunction((b) => document.querySelector('#sales-today').closest('section').querySelector('p').textContent !== b, { timeout: 10000 }, base.sales);
  const now = await hero();
  assert.equal(money(now.sales) - money(base.sales), 3000);
  assert.equal(money(now.moneyIn) - money(base.moneyIn), 3000);
  assert.equal(now.moneyOut, base.moneyOut);
});

await step('amount validation shows a friendly message and saves nothing', async () => {
  await clickText('section[aria-label="Quick actions"] button', 'Record a sale');
  await page.waitForSelector('#sale-amount');
  await clickText('[role=dialog] button[type=submit]', 'Save sale');
  await page.waitForSelector('#sale-amount-error');
  assert.match(await page.$eval('#sale-amount-error', (e) => e.textContent), /above zero/i);
  await page.keyboard.press('Escape'); await sleep(300);
});

let beforeExpense;
await step('record an expense (Transport, 2,500) updates expenses and money out', async () => {
  beforeExpense = await hero();
  await clickText('section[aria-label="Quick actions"] button', 'Record an expense');
  await page.waitForSelector('#exp-amount'); await page.type('#exp-amount', '2500');
  await clickText('[role=dialog] label', 'Transport'); await page.type('#exp-desc', 'Bus fare');
  await clickText('[role=dialog] button[type=submit]', 'Save expense'); await toast('Expense saved');
  await page.waitForFunction((b) => document.querySelector('#sales-today').closest('section').querySelectorAll('dd')[0].textContent !== b, { timeout: 10000 }, beforeExpense.spent);
  const now = await hero();
  assert.equal(money(now.spent) - money(beforeExpense.spent), 2500);
  assert.equal(money(now.moneyOut) - money(beforeExpense.moneyOut), 2500);
  assert.equal(now.sales, (await hero()).sales);
});

await step('credit sale needs a customer, then raises sales and customers owing but not money in', async () => {
  const before = await hero();
  await clickText('section[aria-label="Quick actions"] button', 'Record a sale');
  await page.waitForSelector('#sale-amount'); await page.type('#sale-amount', '5000');
  await clickText('[role=dialog] label', 'Credit');
  await page.waitForSelector('#sale-customer');
  await clickText('[role=dialog] button[type=submit]', 'Save sale');
  await page.waitForFunction(() => document.body.innerText.includes('Choose who owes you'), { timeout: 8000 });
  await page.select('#sale-customer', 'demo-cust-02');
  await clickText('[role=dialog] button[type=submit]', 'Save sale'); await toast('now owes you');
  await page.waitForFunction((o) => document.querySelector('section[aria-labelledby="owing-h"] p').textContent !== o, { timeout: 10000 }, before.owing);
  const now = await hero();
  assert.equal(money(now.sales) - money(before.sales), 5000);
  assert.equal(money(now.owing) - money(before.owing), 5000);
  assert.equal(now.moneyIn, before.moneyIn);
});

await step('data survives a page refresh', async () => {
  const before = await hero(); await goDashboard(); assert.deepEqual(await hero(), before);
});

await step('invoice: record "everything that is left" and it becomes Paid', async () => {
  await page.goto(B + '/invoices/demo-inv-08', { waitUntil: 'networkidle0' });
  await page.waitForSelector('h1');
  assert.match(await bodyText(), /Part paid/);
  await clickText('button', 'Record payment'); await page.waitForSelector('#p-amount');
  await clickText('[role=dialog] button', "Everything that's left");
  await clickText('[role=dialog] button[type=submit]', 'Save payment'); await toast('Payment recorded');
  await page.waitForFunction(() => /Paid/.test(document.querySelector('main').innerText) && !document.body.innerText.includes('Record payment'), { timeout: 10000 });
  assert.match(await bodyText(), /Left to pay\s*₦0/);
});

await step('create an invoice with two items; server total is shown', async () => {
  await page.goto(B + '/invoices/new?customerId=demo-cust-03', { waitUntil: 'networkidle0' });
  await page.waitForSelector('#i-customer');
  await page.waitForFunction(() => document.querySelector('#i-customer').value === 'demo-cust-03');
  await page.type('#item-0-d', 'Rice 50kg'); await page.$eval('#item-0-q', (e) => (e.value = '')); await page.type('#item-0-q', '2'); await page.type('#item-0-p', '82,000');
  await clickText('button', 'Add another item'); await page.waitForSelector('#item-1-d');
  await page.type('#item-1-d', 'Oil'); await page.$eval('#item-1-q', (e) => (e.value = '')); await page.type('#item-1-q', '1'); await page.type('#item-1-p', '52000.50');
  await clickText('button', 'Create invoice'); await toast('Invoice created');
  await page.waitForFunction(() => location.pathname.startsWith('/invoices/') && !location.pathname.endsWith('/new'), { timeout: 10000 });
  await page.waitForFunction(() => document.body.innerText.includes('Left to pay'));
  assert.match(await bodyText(), /₦216,000\.50/);
  assert.match(await bodyText(), /Unpaid|Overdue/);
});

await step('customer paid me from the customer page settles the debt', async () => {
  await page.goto(B + '/customers/demo-cust-02', { waitUntil: 'networkidle0' });
  await page.waitForSelector('h1');
  await clickText('button', 'Customer paid me'); await page.waitForSelector('#paid-amount');
  await clickText('[role=dialog] button', 'They paid everything');
  await clickText('[role=dialog] button[type=submit]', 'Save payment'); await toast('Payment recorded');
  await page.waitForFunction(() => /Amount owing\s*₦0/.test(document.body.innerText), { timeout: 10000 });
});

await step('records: filter to expenses, edit one, delete one', async () => {
  await page.goto(B + '/transactions?type=EXPENSE', { waitUntil: 'networkidle0' });
  await page.waitForSelector('ul li');
  await page.type('input[type=search]', 'Bus fare'); await sleep(900);
  await page.waitForFunction(() => document.querySelectorAll('main ul > li').length === 1, { timeout: 8000 });
  await page.click('button[aria-label^="Edit"]'); await page.waitForSelector('#e-amount');
  await page.$eval('#e-amount', (e) => (e.value = '')); await page.type('#e-amount', '3000');
  await clickText('[role=dialog] button[type=submit]', 'Save changes'); await toast('Record updated');
  await page.waitForFunction(() => document.querySelector('main ul')?.innerText.includes('₦3,000'), { timeout: 8000 });
  await page.click('button[aria-label^="Delete"]'); await clickText('[role=dialog] button', 'Delete record'); await toast('Record deleted');
  await page.waitForFunction(() => document.body.innerText.includes('No records match'), { timeout: 8000 });
});

await step('reports page loads numbers and offers CSV downloads', async () => {
  await page.goto(B + '/reports', { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => document.body.innerText.includes('Money customers owe'), { timeout: 10000 });
  assert.equal(await page.$$eval('a[download]', (a) => a.length), 3);
});

await step('unknown invoice shows a friendly not-found state', async () => {
  await page.goto(B + '/invoices/nope', { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => document.body.innerText.includes("couldn't find that invoice"), { timeout: 8000 });
});

await step('CSV: preview saves nothing, suggestion is not auto-applied, user confirms, re-upload is caught as duplicate', async () => {
  const API = process.env.API_URL ?? 'http://localhost:4000';
  const j = (u, init) => fetch(API + u, init).then((r) => r.json());
  const yesterday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos' }).format(new Date(Date.now() - 86400000));
  // An invoice issued before the bank row's date (a payment can't predate its invoice).
  const inv = (await j('/api/invoices?status=UNPAID&pageSize=100')).items.find((i) => i.issueDate <= yesterday);
  const csv = ['Date,Description,Amount,Direction,Reference',
    `${yesterday},Transfer ${inv.invoiceNumber},${inv.balance},credit,E2E-REF-1`,
    'not-a-date,Broken row,100,credit,E2E-REF-2',
    `${yesterday},Same again,${inv.balance},credit,E2E-REF-1`,
    `${yesterday},Airtime,500,debit,E2E-REF-4`].join('\n');
  const file = path.join(os.tmpdir(), 'settleng-e2e-statement.csv'); fs.writeFileSync(file, csv);
  const importsBefore = (await j('/api/reconciliation/imports')).items.length;

  await page.goto(B + '/reconciliation', { waitUntil: 'networkidle0' });
  await (await page.waitForSelector('#csv-file')).uploadFile(file);
  await page.waitForFunction(() => document.body.innerText.includes('Possible match'), { timeout: 15000 });
  const txt = await bodyText();
  assert.match(txt, /Duplicate/); assert.match(txt, /Can't read/); assert.match(txt, /Nothing is saved yet/);
  assert.equal((await j('/api/reconciliation/imports')).items.length, importsBefore, 'preview must not save');

  await clickText('button', 'Import 4 rows'); await toast('Imported 4 rows');
  await page.waitForFunction(() => location.search.includes('import='), { timeout: 10000 });
  await page.waitForFunction(() => document.body.innerText.includes('This might be a payment for'), { timeout: 10000 });
  assert.equal((await j(`/api/invoices/${inv.id}`)).balance, inv.balance, 'a suggestion must not change any money');

  await clickText('button', 'Yes, match it'); await page.waitForSelector('[role=dialog]');
  assert.match(await page.$eval('[role=dialog]', (e) => e.innerText), /You are saying this row really is that payment/);
  await clickText('[role=dialog] button', 'Yes, record it'); await toast('Payment recorded and matched');
  await page.waitForFunction(() => document.body.innerText.includes('Matched to'), { timeout: 10000 });
  assert.equal((await j(`/api/invoices/${inv.id}`)).status, 'PAID');

  await page.goto(B + '/reconciliation', { waitUntil: 'networkidle0' });
  await (await page.waitForSelector('#csv-file')).uploadFile(file);
  await page.waitForFunction(() => document.body.innerText.includes('Nothing new to import'), { timeout: 15000 });
});

await step('Reset Demo restores the original numbers', async () => {
  await page.goto(B + '/settings', { waitUntil: 'networkidle0' });
  await clickText('button', 'Reset Demo'); await page.waitForSelector('[role=dialog] button.bg-red');
  await clickText('[role=dialog] button', 'Reset demo'); await toast('Demo reset');
  await goDashboard(); const after = await hero();
  assert.equal(after.sales, base.sales); assert.equal(after.owing, base.owing);
});

await step('mobile: bottom bar + opens quick actions; More lists the rest', async () => {
  await page.setViewport({ width: 390, height: 844 });
  await goDashboard();
  await page.click('button[aria-label^="Record a sale, expense"]'); await page.waitForSelector('[role=dialog]');
  assert.match(await bodyText(), /Customer paid me/);
  await page.keyboard.press('Escape'); await sleep(300);
  await clickText('nav[aria-label=Main] button', 'More'); await page.waitForSelector('[role=dialog]');
  assert.match(await page.$eval('[role=dialog]', (e) => e.innerText), /Settings/);
  await page.keyboard.press('Escape');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  assert.equal(overflow, false, 'page scrolls sideways on mobile');
});

console.log(errors.length ? 'PAGE ERRORS: ' + errors.join(' | ') : 'no uncaught page errors');
await browser.close();
