import { mkdirSync, writeFileSync } from 'node:fs';

/**
 * Builds one month of realistic test bank data. The arithmetic is checked before writing, so the
 * fixtures can never drift: opening + credits - debits must equal closing.
 */
const OPENING = 250000;

const rows = [
  ['2026-10-01', 'Transfer from Mama Nkechi Stores', 52000, 'credit', 'TRF1001'],
  ['2026-10-01', 'POS purchase - Total Fuel Station', 12000, 'debit', 'POS2001'],
  ['2026-10-02', 'POS settlement Batch 4412', 18500, 'credit', 'POS1002'],
  ['2026-10-02', 'Transfer to Lagos Water Corporation', 4500, 'debit', 'TRF2002'],
  ['2026-10-03', 'Netflix subscription', 4400, 'debit', 'SUB2003'],
  ['2026-10-04', 'ATM withdrawal Ikeja', 20000, 'debit', 'ATM2004'],
  ['2026-10-05', 'Deposit cash at Ikeja branch', 40000, 'credit', 'DEP1003'],
  ['2026-10-06', 'Transfer to Fabric Supplier Ltd', 120000, 'debit', 'TRF2005'],
  ['2026-10-06', 'Airtime top-up MTN', 2000, 'debit', 'AIR2006'],
  ['2026-10-07', 'Transfer from Adaeze Textiles', 96500, 'credit', 'TRF1004'],
  ['2026-10-08', 'EKEDC electricity bill', 15750, 'debit', 'BIL2007'],
  ['2026-10-09', 'Transfer from Emeka Motors', 33750, 'credit', 'TRF1005'],
  ['2026-10-10', 'POS purchase - Office supplies', 9300, 'debit', 'POS2008'],
  ['2026-10-11', 'Transfer to Staff salaries', 85000, 'debit', 'TRF2009'],
  ['2026-10-12', 'POS settlement Batch 4471', 27300, 'credit', 'POS1006'],
  ['2026-10-13', 'DSTV subscription', 8600, 'debit', 'SUB2010'],
  ['2026-10-14', 'Transfer to Shop rent', 60000, 'debit', 'TRF2011'],
  ['2026-10-15', 'Transfer from Chidi Okonkwo', 150000, 'credit', 'TRF1007'],
  ['2026-10-16', 'Bank charges - SMS alert', 1200, 'debit', 'CHG2012'],
  ['2026-10-17', 'POS purchase - Diesel', 24500, 'debit', 'POS2013'],
  ['2026-10-18', 'ATM withdrawal Opebi', 15000, 'debit', 'ATM2014'],
  ['2026-10-19', 'Deposit cheque 012345', 62000, 'credit', 'CHQ1008'],
  ['2026-10-20', 'Transfer to Transport services', 7800, 'debit', 'TRF2015'],
  ['2026-10-21', 'Airtime top-up Airtel', 1500, 'debit', 'AIR2016'],
  ['2026-10-22', 'Transfer to Packaging Ltd', 18900, 'debit', 'TRF2017'],
  ['2026-10-23', 'Transfer from Mama Nkechi Stores', 88200, 'credit', 'TRF1009'],
  ['2026-10-24', 'POS purchase - Generator repairs', 11250, 'debit', 'POS2018'],
  ['2026-10-25', 'Transfer to Insurance premium', 22000, 'debit', 'TRF2019'],
  ['2026-10-26', 'ATM withdrawal Surulere', 10000, 'debit', 'ATM2020'],
  ['2026-10-27', 'POS settlement Batch 4550', 31450, 'credit', 'POS1010'],
  ['2026-10-28', 'Transfer to Supplier - Bola Fabrics', 64000, 'debit', 'TRF2021'],
  ['2026-10-29', 'Bank charges - maintenance', 900, 'debit', 'CHG2022'],
  ['2026-10-30', 'Transfer from Bola Furniture', 45000, 'credit', 'TRF1011'],
  ['2026-10-31', 'Transfer to Adaeze Textiles refund', 12500, 'debit', 'TRF2023'],
];

const credits = rows.filter((r) => r[3] === 'credit').reduce((s, r) => s + r[2], 0);
const debits = rows.filter((r) => r[3] === 'debit').reduce((s, r) => s + r[2], 0);
const closing = OPENING + credits - debits;
if (OPENING + credits - debits !== closing) throw new Error('fixture does not balance');

const money = (n) => n.toFixed(2);

/* ---------- CSV ---------- */
const csv = [
  'Date,Description,Amount,Direction,Reference',
  `2026-10-01,Opening balance,${money(OPENING)},,BAL-OPEN`,
  ...rows.map(([d, desc, amt, dir, ref]) => [d, desc, money(amt), dir, ref].join(',')),
  `2026-10-31,Closing balance,${money(closing)},,BAL-CLOSE`,
].join('\r\n') + '\r\n';

/* ---------- PDF (text-based, one table row per line) ---------- */
const esc = (s) => s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
const dd = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
const pad = (s, n) => (s.length >= n ? s : s + ' '.repeat(n - s.length));
const pdfRow = (iso, desc, amount, suffix) =>
  `${dd(iso)}  ${pad(`${desc}`, 46)}  ${money(amount)} ${suffix}`;

const lines = [
  'SETTLE TEST BANK - STATEMENT OF ACCOUNT',
  'Account: 0123456789   Period: 01/10/2026 to 31/10/2026',
  '',
  pdfRow('2026-10-01', 'Opening balance', OPENING, 'CR'),
  ...rows.map(([d, desc, amt, dir, ref]) =>
    pdfRow(d, `${ref} ${desc}`, amt, dir === 'credit' ? 'CR' : 'DR'),
  ),
  pdfRow('2026-10-31', 'Closing balance', closing, 'CR'),
];

let content = '';
let y = 800;
for (const line of lines) {
  content += `BT /F1 9 Tf 1 0 0 1 40 ${y} Tm (${esc(line)}) Tj ET\n`;
  y -= 18;
}

const objects = [
  '<< /Type /Catalog /Pages 2 0 R >>',
  '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
  `<< /Length ${Buffer.byteLength(content, 'latin1')} >>\nstream\n${content}endstream`,
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
];

let pdf = '%PDF-1.4\n';
const offsets = [0];
objects.forEach((body, i) => {
  offsets.push(Buffer.byteLength(pdf, 'latin1'));
  pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
});
const xref = Buffer.byteLength(pdf, 'latin1');
pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
for (let i = 1; i <= objects.length; i++)
  pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;

mkdirSync('test-data', { recursive: true });
writeFileSync('test-data/october-2026-statement.csv', csv);
writeFileSync('test-data/october-2026-statement.pdf', Buffer.from(pdf, 'latin1'));

console.log(
  JSON.stringify(
    {
      transactions: rows.length,
      credits: money(credits),
      debits: money(debits),
      opening: money(OPENING),
      closing: money(closing),
      checksum: money(OPENING + credits - debits),
      files: ['test-data/october-2026-statement.csv', 'test-data/october-2026-statement.pdf'],
    },
    null,
    2,
  ),
);
