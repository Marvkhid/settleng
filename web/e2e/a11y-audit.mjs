// Accessibility (axe-core WCAG 2.1 AA), sideways-scroll and tap-size audit of every screen at desktop and phone size.
// Needs `npm run preview` running. Prints NO ISSUES when clean.
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const axeSrc = fs.readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');
const B = process.env.BASE_URL ?? 'http://localhost:3000';
const browser = await puppeteer.launch({ args: [...chromium.args, '--no-sandbox'], executablePath: process.env.CHROME_PATH ?? (await chromium.executablePath()), headless: true });
const routes = ['/', '/dashboard', '/customers', '/customers?owing=1', '/customers/demo-cust-01', '/invoices', '/invoices/new', '/invoices/demo-inv-08', '/invoices/demo-inv-08/edit',
  '/transactions', '/transactions?type=EXPENSE', '/transactions/new', '/reconciliation', '/reconciliation?import=demo-import-2', '/reports', '/settings', '/nope', '/invoices/nope'];
const sizes = [['desktop', 1280, 900], ['mobile', 360, 740]];
const issues = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function audit(page, label) {
  await page.evaluate(axeSrc);
  const res = await page.evaluate(async () => (await axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] })).violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.slice(0, 3).map((n) => n.target.join(' ') + ' :: ' + (n.failureSummary || '').split('\n').slice(1, 2).join(' ').slice(0, 130)), count: v.nodes.length })));
  for (const v of res) issues.push(`[axe ${v.impact}] ${label}: ${v.id} (${v.count}) ${v.help}\n      ${v.nodes.join('\n      ')}`);
}
async function layout(page, label, w) {
  const r = await page.evaluate((w) => {
    const out = { overflow: document.documentElement.scrollWidth > window.innerWidth + 1, small: [], h1: document.querySelectorAll('h1').length, title: document.title, lang: document.documentElement.lang };
    const vis = (e) => { const b = e.getBoundingClientRect(); const cs = getComputedStyle(e); return b.width > 0 && b.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && !e.closest('.sr-only'); };
    document.querySelectorAll('button, a[href], input:not([type=hidden]):not(.sr-only), select, textarea, [role=button]').forEach((e) => {
      if (!vis(e)) return; const b = e.getBoundingClientRect();
      const inline = e.tagName === 'A' && e.closest('p, li > span, dd, figcaption') && getComputedStyle(e).display === 'inline';
      if (inline) return;
      if (b.height < 40 || b.width < 40) out.small.push(`${e.tagName.toLowerCase()} "${(e.innerText || e.getAttribute('aria-label') || e.id || '').trim().slice(0, 28)}" ${Math.round(b.width)}x${Math.round(b.height)}`);
    });
    return out;
  }, w);
  if (r.overflow) issues.push(`[layout] ${label}: page scrolls sideways`);
  if (r.small.length) issues.push(`[tap-size] ${label}: ${r.small.slice(0, 6).join('; ')}${r.small.length > 6 ? ` (+${r.small.length - 6})` : ''}`);
  if (r.h1 !== 1 && !label.includes('/nope')) issues.push(`[structure] ${label}: ${r.h1} h1 elements`);
  if (!r.title || r.title === 'localhost:3000') issues.push(`[structure] ${label}: missing page title`);
  if (r.lang !== 'en') issues.push(`[structure] ${label}: html lang is "${r.lang}"`);
}

for (const [name, w, h] of sizes) {
  const page = await browser.newPage(); await page.setViewport({ width: w, height: h });
  for (const r of routes) {
    await page.goto(B + r, { waitUntil: 'networkidle0', timeout: 60000 }); await sleep(500);
    await audit(page, `${name} ${r}`); await layout(page, `${name} ${r}`, w);
  }
  // open dialogs
  await page.goto(B + '/dashboard', { waitUntil: 'networkidle0' });
  const open = async (text, label) => {
    await page.evaluate((t) => [...document.querySelectorAll('button')].find((b) => b.textContent.includes(t) && b.offsetParent)?.click(), text);
    await page.waitForSelector('[role=dialog]', { timeout: 8000 }); await sleep(500);
    await audit(page, `${name} dialog:${label}`); await layout(page, `${name} dialog:${label}`, w);
    await page.keyboard.press('Escape'); await sleep(400);
  };
  await open('Record a sale', 'sale'); await open('Record an expense', 'expense'); await open('Customer paid me', 'paid');
  await page.goto(B + '/customers', { waitUntil: 'networkidle0' });
  await open('Add customer', 'add-customer');
  await page.close();
}
console.log(issues.length ? issues.join('\n') : 'NO ISSUES');
await browser.close();
