import { readFileSync, writeFileSync } from 'node:fs';

const edits = [
  {
    file: 'api/src/reports/reports.service.ts',
    pairs: [
      [
        '  /** Daily money in/out and the running balance taken from uploaded statements. */',
        `  /**
   * The most recent upload as a whole file. The dashboard shows this rather than a rolling window,
   * because "does opening + credits - debits = closing" is only a meaningful check for the file
   * that states those balances.
   */
  async latestStatement() {
    const businessId = requireBusinessId();
    const [imp, importCount] = await Promise.all([
      this.prisma.reconciliationImport.findFirst({
        where: { businessId },
        orderBy: { createdAt: 'desc' },
        include: {
          rows: { select: { amount: true, direction: true, matchStatus: true } },
        },
      }),
      this.prisma.reconciliationImport.count({ where: { businessId } }),
    ]);
    if (!imp)
      return {
        credits: new Decimal(0),
        debits: new Decimal(0),
        net: new Decimal(0),
        openingBalance: null as Decimal | null,
        closingBalance: null as Decimal | null,
        reconciles: null as boolean | null,
        importCount: 0,
        rowCount: 0,
        filename: null as string | null,
      };
    let credits = new Decimal(0);
    let debits = new Decimal(0);
    let rowCount = 0;
    for (const r of imp.rows) {
      if (!r.amount) continue;
      if (r.matchStatus === 'INVALID' || r.matchStatus === 'DUPLICATE') continue;
      rowCount++;
      if (r.direction === 'IN') credits = credits.plus(D(r.amount));
      else if (r.direction === 'OUT') debits = debits.plus(D(r.amount));
    }
    const opening = imp.openingBalance ? D(imp.openingBalance) : null;
    const closing = imp.closingBalance ? D(imp.closingBalance) : null;
    return {
      credits,
      debits,
      net: credits.minus(debits),
      openingBalance: opening,
      closingBalance: closing,
      reconciles:
        opening && closing
          ? opening.plus(credits).minus(debits).equals(closing)
          : null,
      importCount,
      rowCount,
      filename: imp.filename,
    };
  }

  /** Daily money in/out and the running balance taken from uploaded statements. */`,
      ],
      [
        '      this.statementTotals({ from: thirtyDaysBack, to: today }),\n      this.cashflow({ from: thirtyDaysBack, to: today }),',
        '      this.latestStatement(),\n      this.cashflow({ from: thirtyDaysBack, to: today }),',
      ],
    ],
  },
  {
    file: 'web/components/dashboard/dashboard-view.tsx',
    pairs: [
      [
        '        {s.rowCount} rows from {s.importCount} uploaded {s.importCount === 1 ? "statement" : "statements"}, last 30 days.',
        '        {s.rowCount} rows from your most recent upload ({s.importCount} in total).',
      ],
    ],
  },
  {
    file: 'tools/e2e-import.mjs',
    pairs: [
      [
        "writeFileSync('/tmp/bad.csv', 'Date,Description,Amount\\nnot-a-date,Nonsense,abc\\n,,\\n');",
        "writeFileSync('/tmp/bad.csv', 'Date,Description,Amount\\nnot-a-date,Nonsense,abc\\n2026-10-05,Broken amount,xyz\\n');",
      ],
      [
        `  ok('dashboard money in comes from the statement', NGN(dash.data?.moneyIn) === 644700, { moneyIn: dash.data?.moneyIn });
  ok('dashboard money out comes from the statement', NGN(dash.data?.moneyOut) === 531100, { moneyOut: dash.data?.moneyOut });
  ok('dashboard statement block matches', dash.data?.statement?.rowCount === 34 && dash.data?.statement?.credits === '644700.00', dash.data?.statement);`,
        `  ok('dashboard card shows the whole uploaded file', dash.data?.statement?.rowCount === 34 && dash.data?.statement?.credits === '644700.00' && dash.data?.statement?.debits === '531100.00', dash.data?.statement);
  ok('dashboard statement balances against its own figures', dash.data?.statement?.reconciles === true);
  const oct = await call('/api/reports/summary?from=2026-10-01&to=2026-10-31');
  ok('October summary money in matches statement credits', NGN(oct.data?.moneyIn) === 644700, { moneyIn: oct.data?.moneyIn });
  ok('October summary money out matches statement debits', NGN(oct.data?.moneyOut) === 531100, { moneyOut: oct.data?.moneyOut });`,
      ],
      [
        `    ok('other workspace still has its own statement totals', personalDash.data?.statement?.rowCount === 34 && personalDash.data?.moneyIn === '644700.00', {
      rows: personalDash.data?.statement?.rowCount,
    });`,
        `    ok('other workspace shows its own statement totals', personalDash.data?.statement?.rowCount === 34 && personalDash.data?.statement?.credits === '644700.00', {
      rows: personalDash.data?.statement?.rowCount,
      credits: personalDash.data?.statement?.credits,
    });`,
      ],
      [
        "body: { amount: '20000', method: 'CASH', description: 'E2E sale' }",
        "body: { amount: '20000', paymentMethod: 'CASH', description: 'E2E sale' }",
      ],
      [
        "ok('dashboard reflects the edit', NGN(afterEdit.data?.moneyIn) === 669700, { moneyIn: afterEdit.data?.moneyIn });",
        "ok('dashboard reflects the edit', NGN(afterEdit.data?.moneyIn) === 25000, { moneyIn: afterEdit.data?.moneyIn });",
      ],
      [
        "ok('dashboard reflects the deletion', NGN(afterDelete.data?.moneyIn) === 644700, { moneyIn: afterDelete.data?.moneyIn });",
        "ok('dashboard reflects the deletion', NGN(afterDelete.data?.moneyIn) === 0, { moneyIn: afterDelete.data?.moneyIn });",
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
console.log(failures === 0 ? 'FINAL_PATCH_OK' : 'FINAL_PATCH_FAILURES=' + failures);
