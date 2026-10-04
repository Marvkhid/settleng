import Decimal from 'decimal.js';
import Papa from 'papaparse';
import { addDaysIso, isRealDate } from '../common/dates';

export const MAX_FILE_BYTES = 1_000_000;
export const MAX_ROWS = 500;

export interface ColumnMapping {
  date: string;
  description?: string;
  reference?: string;
  amount?: string;
  direction?: string;
  credit?: string;
  debit?: string;
}
export interface ParsedRow {
  rowNumber: number;
  externalReference: string | null;
  date: string | null;
  description: string | null;
  amount: string | null;
  direction: 'IN' | 'OUT' | null;
  status: 'VALID' | 'INVALID' | 'DUPLICATE';
  note: string | null;
}
export interface ParseResult {
  headers: string[];
  mapping: ColumnMapping | null;
  problems: string[];
  rows: ParsedRow[];
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const CANDIDATES: Record<keyof ColumnMapping, string[]> = {
  date: [
    'date',
    'transactiondate',
    'transdate',
    'txndate',
    'valuedate',
    'postingdate',
  ],
  description: [
    'description',
    'narration',
    'narrative',
    'details',
    'remark',
    'remarks',
    'particulars',
  ],
  reference: [
    'reference',
    'ref',
    'transactionreference',
    'referencenumber',
    'refno',
    'sessionid',
    'transactionid',
  ],
  amount: ['amount', 'transactionamount', 'amt', 'value'],
  direction: ['direction', 'type', 'drcr', 'creditdebit', 'transactiontype'],
  credit: ['credit', 'credits', 'moneyin', 'deposit'],
  debit: ['debit', 'debits', 'moneyout', 'withdrawal'],
};

export function detectMapping(headers: string[]): Partial<ColumnMapping> {
  const out: Partial<ColumnMapping> = {};
  for (const key of Object.keys(CANDIDATES) as (keyof ColumnMapping)[]) {
    const hit = headers.find((h) => CANDIDATES[key].includes(norm(h)));
    if (hit) out[key] = hit;
  }
  return out;
}

export function parseAmount(
  raw: string,
): { value: Decimal; negative: boolean } | null {
  let s = raw
    .trim()
    .replace(/₦|NGN|N(?=\d)/gi, '')
    .replace(/[,\s]/g, '');
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  if (s.startsWith('-')) {
    negative = true;
    s = s.slice(1);
  } else if (s.startsWith('+')) s = s.slice(1);
  if (!/^\d{1,12}(\.\d{1,2})?$/.test(s)) return null;
  const value = new Decimal(s);
  return value.lte(0) ? null : { value, negative };
}

/** Accepts 2026-10-04, 04/10/2026 and 04-10-2026 (day first, as used in Nigeria), with or without a time. */
export function parseDate(raw: string, today: string): string | null {
  const s = raw.trim();
  let iso: string | null = null;
  const a = /^(\d{4})-(\d{2})-(\d{2})(?:[T ].*)?$/.exec(s);
  const b = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:\s.*)?$/.exec(s);
  if (a) iso = `${a[1]}-${a[2]}-${a[3]}`;
  else if (b) iso = `${b[3]}-${b[2].padStart(2, '0')}-${b[1].padStart(2, '0')}`;
  if (!iso || !isRealDate(iso)) return null;
  if (iso < '2000-01-01' || iso > addDaysIso(today, 0)) return null;
  return iso;
}

const IN_WORDS = [
  'in',
  'credit',
  'cr',
  'income',
  'deposit',
  'received',
  'moneyin',
];
const OUT_WORDS = [
  'out',
  'debit',
  'dr',
  'expense',
  'withdrawal',
  'paid',
  'moneyout',
];

export function parseStatement(
  text: string,
  today: string,
  overrides?: Partial<ColumnMapping>,
): ParseResult {
  const clean = text.replace(/^\uFEFF/, '');
  const parsed = Papa.parse<Record<string, string>>(clean, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (h) => h.trim(),
  });
  const headers = (parsed.meta.fields ?? []).filter(Boolean);
  const problems: string[] = [];
  if (headers.length < 2)
    return {
      headers,
      mapping: null,
      problems: [
        'We could not read columns from this file. Check that it is a comma-separated CSV with a header row.',
      ],
      rows: [],
    };
  if (parsed.data.length === 0)
    return {
      headers,
      mapping: null,
      problems: ['This file has no data rows.'],
      rows: [],
    };
  if (parsed.data.length > MAX_ROWS)
    return {
      headers,
      mapping: null,
      problems: [
        `This file has more than ${MAX_ROWS} rows. Please split it into smaller files.`,
      ],
      rows: [],
    };

  const m = {
    ...detectMapping(headers),
    ...overrides,
  } as Partial<ColumnMapping>;
  for (const k of Object.keys(m) as (keyof ColumnMapping)[])
    if (m[k] && !headers.includes(m[k]))
      problems.push(`The column "${m[k]}" is not in the file.`);
  if (!m.date) problems.push('We could not find a date column.');
  if (!m.amount && !(m.credit && m.debit))
    problems.push(
      'We could not find an amount column (or separate credit and debit columns).',
    );
  if (problems.length) return { headers, mapping: null, problems, rows: [] };
  const mapping = m as ColumnMapping;

  const rows: ParsedRow[] = parsed.data.map((rec, i) => {
    const rowNumber = i + 1;
    const get = (col?: string) =>
      col ? (rec[col] ?? '').toString().trim() : '';
    const date = parseDate(get(mapping.date), today);
    const description = get(mapping.description) || null;
    const externalReference = get(mapping.reference) || null;
    let amount: Decimal | null = null;
    let direction: 'IN' | 'OUT' | null = null;
    let error: string | null = null;

    if (mapping.amount) {
      const a = parseAmount(get(mapping.amount));
      if (!a) error = 'The amount could not be read.';
      else {
        amount = a.value;
        if (mapping.direction) {
          const d = norm(get(mapping.direction));
          direction = IN_WORDS.includes(d)
            ? 'IN'
            : OUT_WORDS.includes(d)
              ? 'OUT'
              : null;
          if (!direction)
            error = 'We could not tell if this is money in or money out.';
        } else direction = a.negative ? 'OUT' : 'IN';
      }
    } else {
      const cr = get(mapping.credit) ? parseAmount(get(mapping.credit)) : null;
      const dr = get(mapping.debit) ? parseAmount(get(mapping.debit)) : null;
      if (cr && dr) error = 'This row has both a credit and a debit.';
      else if (cr) {
        amount = cr.value;
        direction = 'IN';
      } else if (dr) {
        amount = dr.value;
        direction = 'OUT';
      } else error = 'The amount could not be read.';
    }
    if (!error && !date)
      error =
        'The date could not be read (use a real date that is not in the future).';
    return {
      rowNumber,
      externalReference,
      date,
      description,
      amount: amount ? amount.toFixed(2) : null,
      direction,
      status: error ? 'INVALID' : 'VALID',
      note: error,
    };
  });
  return { headers, mapping, problems, rows };
}

/** Same reference, or (when there is no reference) same date + amount + direction + text, counts as a duplicate. */
export function duplicateKey(
  r: Pick<
    ParsedRow,
    'externalReference' | 'date' | 'amount' | 'direction' | 'description'
  >,
): string {
  if (r.externalReference) return `ref:${r.externalReference.toLowerCase()}`;
  return `row:${r.date}|${r.amount}|${r.direction}|${(r.description ?? '').toLowerCase().replace(/\s+/g, ' ').trim()}`;
}

export function markDuplicates(
  rows: ParsedRow[],
  existingKeys: Set<string>,
): ParsedRow[] {
  const seen = new Set(existingKeys);
  return rows.map((r) => {
    if (r.status !== 'VALID') return r;
    const k = duplicateKey(r);
    if (seen.has(k))
      return {
        ...r,
        status: 'DUPLICATE',
        note: existingKeys.has(k)
          ? 'Already imported before'
          : 'Appears twice in this file',
      };
    seen.add(k);
    return r;
  });
}

export const SAMPLE_CSV =
  [
    'Date,Description,Amount,Direction,Reference',
    '2026-10-01,Transfer from Mama Nkechi Stores AMM-0014,52000.00,credit,TRF1001',
    '2026-10-02,POS settlement,18500.00,credit,TRF1002',
    '2026-10-02,Airtime purchase,1500.00,debit,TRF1003',
  ].join('\r\n') + '\r\n';
