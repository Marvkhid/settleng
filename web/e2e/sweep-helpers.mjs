// Shared helpers for the click-through sweeps. Needs `npm run preview` running (use CHROME_PATH for your own Chrome).
import os from 'node:os';
import path from 'node:path';
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
export { assert };
export const B = process.env.BASE_URL ?? 'http://localhost:3000', API = process.env.API_URL ?? 'http://localhost:4000';
export const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos' }).format(new Date());
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const bad = []; // API responses >= 400, collected across the run
export const results = { pass: 0, fail: 0 };
export async function launch() {
  const browser = await puppeteer.launch({ args: [...chromium.args, '--no-sandbox'], executablePath: process.env.CHROME_PATH ?? (await chromium.executablePath()), headless: true });
  return browser;
}
export async function newPage(browser, w = 1280, h = 900) {
  const p = await browser.newPage(); await p.setViewport({ width: w, height: h });
  p.setDefaultTimeout(40000);
  p.on('pageerror', (e) => bad.push('PAGEERROR ' + e.message.slice(0, 160)));
  p.on('response', (r) => { if (r.url().includes(':4000/api') && r.status() >= 400) bad.push(`${r.status()} ${r.request().method()} ${r.url().replace(API, '')}`); });
  return p;
}
export const step = async (name, fn, page) => {
  try { await fn(); console.log('PASS', name); results.pass++; }
  catch (e) { console.log('FAIL', name, '\n     ', String(e.message).split('\n')[0].slice(0, 220), '\n      at', (String(e.stack).split('\n').find((l) => /sweep[AB]\.mjs/.test(l)) ?? '').trim()); results.fail++; process.exitCode = 1; if (page) await page.screenshot({ path: path.join(os.tmpdir(), `settleng-sweep-fail-${results.fail}.png`) }).catch(() => {}); }
};
export const text = (p) => p.evaluate(() => document.body.innerText);
export const waitText = (p, re, timeout = 30000) => p.waitForFunction((src, flags) => new RegExp(src, flags).test(document.body.innerText), { timeout }, re.source, re.flags);
export const go = async (p, path) => { await p.goto(B + path, { waitUntil: 'domcontentloaded', timeout: 90000 }); await p.waitForSelector('main, #main', { timeout: 60000 }); await p.waitForNetworkIdle({ idleTime: 800, timeout: 60000 }).catch(() => {}); };
export const clickText = async (p, selector, t) => {
  await p.waitForFunction((s, tx) => [...document.querySelectorAll(s)].some((e) => e.textContent.trim().includes(tx) && !e.disabled && e.offsetParent !== null), { timeout: 30000 }, selector, t);
  await p.evaluate((s, tx) => [...document.querySelectorAll(s)].find((e) => e.textContent.trim().includes(tx) && !e.disabled && e.offsetParent !== null).click(), selector, t);
};
export const toast = (p, t) => waitText(p, new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), 20000);
export const j = (u, init) => fetch(API + u, init).then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));
export const h1 = (p) => p.$eval('h1', (e) => e.textContent.trim());
export const money = (s) => Number(String(s).replace(/[₦,+\-\s]/g, ''));
