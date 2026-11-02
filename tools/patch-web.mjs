import { readFileSync, writeFileSync } from 'node:fs';

/** Web-side UI for statement totals: types, a dashboard card, and import-detail totals. */
const edits = [
  {
    file: 'web/types/api.ts',
    pairs: [
      [
        `  topDebtors: Debtor[]; recentActivity: ActivityItem[];
}`,
        `  topDebtors: Debtor[]; recentActivity: ActivityItem[];
  statement: StatementTotals;
  cashflow: Cashflow;
}

/** Totals taken from an uploaded bank statement, never estimated. */
export interface StatementTotals {
  credits: string; debits: string; net: string;
  openingBalance: string | null; closingBalance: string | null;
  reconciles: boolean | null; importCount: number; rowCount: number;
}
export interface CashflowPoint { date: string; in: string; out: string; net: string; balance: string }
export interface Cashflow {
  from: string; to: string; openingBalance: string | null; openingKnown: boolean;
  closingBalance: string; points: CashflowPoint[];
}`,
      ],
      [
        `export interface ImportDetail { id: string; filename: string; status: "PENDING_REVIEW" | "COMPLETED"; rowCount: number; createdAt: string; notice: string; rows: ImportRow[] }`,
        `export interface ImportDetail {
  id: string; filename: string; status: "PENDING_REVIEW" | "COMPLETED"; rowCount: number; createdAt: string; notice: string; rows: ImportRow[];
  statement: { credits: string; debits: string; net: string; openingBalance: string | null; closingBalance: string | null; reconciles?: boolean | null };
}`,
      ],
    ],
  },
  {
    file: 'web/components/dashboard/dashboard-view.tsx',
    pairs: [
      [
        'function ActivityRow({ a, today }: { a: ActivityItem; today: string }) {',
        `function Statement({ d }: { d: Dashboard }) {
  const s = d.statement;
  if (!s || s.importCount === 0) return null;
  const figures: [string, string][] = [
    ["Money in (credits)", formatNaira(s.credits)],
    ["Money out (debits)", formatNaira(s.debits)],
    ["Net movement", formatNaira(s.net)],
  ];
  return (
    <section aria-labelledby="stmt-h" className="rounded-2xl border border-line bg-surface p-4 md:p-6">
      <h2 id="stmt-h" className="text-xl font-bold">From your bank statement</h2>
      <p className="mt-1 text-slate">
        {s.rowCount} rows from {s.importCount} uploaded {s.importCount === 1 ? "statement" : "statements"}, last 30 days.
      </p>
      <dl className="mt-3 grid gap-3 sm:grid-cols-3">
        {figures.map(([label, value]) => (
          <div key={label}>
            <dt className="text-sm text-slate">{label}</dt>
            <dd className="figure tnum text-lg font-bold">{value}</dd>
          </div>
        ))}
      </dl>
      {(s.openingBalance || s.closingBalance) && (
        <p className="mt-3 text-sm text-slate">
          Opening {s.openingBalance ? formatNaira(s.openingBalance) : "not stated"} to closing{" "}
          {s.closingBalance ? formatNaira(s.closingBalance) : "not stated"}.
        </p>
      )}
    </section>
  );
}

function ActivityRow({ a, today }: { a: ActivityItem; today: string }) {`,
      ],
      [
        `          <PerformanceChart />
          <div className="grid items-start gap-6 lg:grid-cols-2">`,
        `          <PerformanceChart />
          <Statement d={q.data} />
          <div className="grid items-start gap-6 lg:grid-cols-2">`,
      ],
    ],
  },
  {
    file: 'web/components/forms/reconciliation-view.tsx',
    pairs: [
      [
        `      <p className="mt-1 text-slate">{d.notice}</p>`,
        `      <p className="mt-1 text-slate">{d.notice}</p>
      <dl className="mt-4 grid grid-cols-2 gap-3 rounded-2xl border border-line bg-surface p-4 sm:grid-cols-4">
        <div><dt className="text-sm text-slate">Money in</dt><dd className="figure tnum font-bold text-emerald-ink">{formatNaira(d.statement.credits)}</dd></div>
        <div><dt className="text-sm text-slate">Money out</dt><dd className="figure tnum font-bold">{formatNaira(d.statement.debits)}</dd></div>
        <div><dt className="text-sm text-slate">Opening</dt><dd className="figure tnum font-bold">{d.statement.openingBalance ? formatNaira(d.statement.openingBalance) : "—"}</dd></div>
        <div><dt className="text-sm text-slate">Closing</dt><dd className="figure tnum font-bold">{d.statement.closingBalance ? formatNaira(d.statement.closingBalance) : "—"}</dd></div>
      </dl>
      {d.statement.reconciles === false && (
        <p role="alert" className="mt-3 rounded-xl bg-red-wash px-3 py-2 font-semibold text-red">
          This file does not add up: opening plus money in minus money out does not equal the closing balance it states.
        </p>
      )}`,
      ],
    ],
  },
  {
    file: 'api/src/reconciliation/reconciliation.service.ts',
    pairs: [
      [
        `      statement: {
        ...this.fileTotals(imp.rows),
        openingBalance: imp.openingBalance ? money(D(imp.openingBalance)) : null,
        closingBalance: imp.closingBalance ? money(D(imp.closingBalance)) : null,
      },`,
        `      statement: {
        ...this.fileTotals(imp.rows),
        openingBalance: imp.openingBalance ? money(D(imp.openingBalance)) : null,
        closingBalance: imp.closingBalance ? money(D(imp.closingBalance)) : null,
        reconciles: this.fileReconciles(imp.rows, imp.openingBalance, imp.closingBalance),
      },`,
      ],
      [
        '  private async syncImportStatus(',
        `  /** Does opening + credits - debits equal the closing balance the file states? */
  private fileReconciles(
    rows: { amount: Prisma.Decimal | null; direction: 'IN' | 'OUT' | null; matchStatus: string }[],
    opening: Prisma.Decimal | null,
    closing: Prisma.Decimal | null,
  ): boolean | null {
    if (!opening || !closing) return null;
    const totals = this.fileTotals(rows);
    return D(opening)
      .plus(D(totals.credits))
      .minus(D(totals.debits))
      .equals(D(closing));
  }

  private async syncImportStatus(`,
      ],
    ],
  },
];

let failures = 0;
for (const edit of edits) {
  let src = readFileSync(edit.file, 'utf8').replace(/\r\n/g, '\n');
  for (const [from, to] of edit.pairs) {
    if (!src.includes(from)) {
      console.error('MISSING: ' + edit.file + ' :: ' + from.split('\n')[0].slice(0, 60));
      failures++;
      continue;
    }
    src = src.replace(from, to);
  }
  writeFileSync(edit.file, src);
}
console.log(failures === 0 ? 'WEB_PATCH_OK' : 'WEB_PATCH_FAILURES=' + failures);
