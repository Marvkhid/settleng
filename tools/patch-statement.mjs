import { readFileSync, writeFileSync } from 'node:fs';

/**
 * One-off patcher for the statement-import work. Exact-match replacements so nothing is guessed at:
 * every anchor that is missing is reported instead of being silently skipped.
 */
const edits = [
  {
    file: 'api/src/reconciliation/reconciliation.service.ts',
    pairs: [
      [
        "import { Prisma } from '../generated/prisma/client';",
        "import Decimal from 'decimal.js';\nimport { Prisma } from '../generated/prisma/client';",
      ],
      [
        "import { suggestMatches } from './matcher';",
        "import { suggestMatches } from './matcher';\nimport { pdfToStatementCsv } from './pdf-text';",
      ],
      [
        `    if (/\\.pdf$/i.test(name))
      throw new BadRequestException(
        'PDF statements are not read yet — text inside a PDF copy cannot be trusted to keep rows in order. Export the statement as CSV or .xlsx from your bank and upload that.',
      );`,
        `    if (/\\.pdf$/i.test(name)) {
      const { csv, rows } = pdfToStatementCsv(file.buffer);
      if (rows === 0)
        throw new BadRequestException(
          'We could not find any transactions in that PDF. Scanned or image-only statements contain no readable text — export the statement as CSV or .xlsx from your bank instead.',
        );
      return csv;
    }`,
      ],
      [
        `          filename: file!.originalname.slice(0, 200),
          rowCount: rows.length,`,
        `          filename: file!.originalname.slice(0, 200),
          rowCount: rows.length,
          openingBalance: parsed.balances.openingBalance,
          closingBalance: parsed.balances.closingBalance,`,
      ],
      [
        `      createdAt: imp.createdAt.toISOString(),
      notice:`,
        `      createdAt: imp.createdAt.toISOString(),
      statement: {
        ...this.fileTotals(imp.rows),
        openingBalance: imp.openingBalance ? money(D(imp.openingBalance)) : null,
        closingBalance: imp.closingBalance ? money(D(imp.closingBalance)) : null,
      },
      notice:`,
      ],
      [
        '  private async syncImportStatus(',
        `  /**
   * What the uploaded file adds up to. Credits and debits come only from rows that were read
   * successfully, so an unreadable row can never inflate the totals.
   */
  private fileTotals(
    rows: {
      amount: Prisma.Decimal | null;
      direction: 'IN' | 'OUT' | null;
      matchStatus: string;
    }[],
  ) {
    let credits = new Decimal(0);
    let debits = new Decimal(0);
    for (const r of rows) {
      if (!r.amount) continue;
      if (r.matchStatus === 'INVALID' || r.matchStatus === 'DUPLICATE') continue;
      if (r.direction === 'IN') credits = credits.plus(D(r.amount));
      else if (r.direction === 'OUT') debits = debits.plus(D(r.amount));
    }
    return {
      credits: money(credits),
      debits: money(debits),
      net: money(credits.minus(debits)),
    };
  }

  private async syncImportStatus(`,
      ],
      [
        `      counts: this.counts(rows),
    };
  }`,
        `      counts: this.counts(rows),
      statement: {
        ...this.fileTotals(
          rows.map((r) => ({
            amount: r.amount ? new Prisma.Decimal(r.amount) : null,
            direction: r.direction,
            matchStatus: r.matchStatus,
          })),
        ),
        openingBalance: parsed.balances.openingBalance,
        closingBalance: parsed.balances.closingBalance,
      },
    };
  }`,
      ],
    ],
  },
  {
    file: 'api/prisma/schema.prisma',
    pairs: [
      [
        `  rowCount   Int
  createdAt  DateTime     @default(now())`,
        `  rowCount   Int
  /// Opening and closing balances printed inside the uploaded file, to check its arithmetic.
  openingBalance Decimal? @db.Decimal(14, 2)
  closingBalance Decimal? @db.Decimal(14, 2)
  createdAt  DateTime     @default(now())`,
      ],
    ],
  },
  {
    file: 'api/src/reports/reports.service.ts',
    pairs: [
      [
        '    const [invSales, txns, owing, catRows] = await Promise.all([\n      this.invoiceSalesByDay(range),\n      this.txnsByDay(range),\n      this.customersOwing(),',
        '    const [invSales, txns, owing, catRows, stmt] = await Promise.all([\n      this.invoiceSalesByDay(range),\n      this.txnsByDay(range),\n      this.customersOwing(),\n      this.statementTotals(range),',
      ],
      [
        `    const moneyIn = sum(
      txns.filter((t) => t.type === 'INCOME').map((t) => t.amount),
    );
    const moneyOut = sum(
      txns.filter((t) => t.type === 'EXPENSE').map((t) => t.amount),
    );`,
        `    // A statement row that was matched to an invoice already created a payment transaction, so
    // that payment is removed here before the statement row itself is added: one naira, one count.
    const moneyIn = sum(
      txns.filter((t) => t.type === 'INCOME').map((t) => t.amount),
    )
      .minus(stmt.createdTransactions.income)
      .plus(stmt.credits);
    const moneyOut = sum(
      txns.filter((t) => t.type === 'EXPENSE').map((t) => t.amount),
    )
      .minus(stmt.createdTransactions.expense)
      .plus(stmt.debits);`,
      ],
      [
        `      expensesByCategory: breakdown('EXPENSE'),
      incomeByCategory: breakdown('INCOME'),
    };
  }`,
        `      expensesByCategory: breakdown('EXPENSE'),
      incomeByCategory: breakdown('INCOME'),
      statement: {
        credits: money(stmt.credits),
        debits: money(stmt.debits),
        net: money(stmt.net),
        openingBalance: stmt.openingBalance ? money(stmt.openingBalance) : null,
        closingBalance: stmt.closingBalance ? money(stmt.closingBalance) : null,
        reconciles: stmt.reconciles,
        importCount: stmt.importCount,
        rowCount: stmt.rowCount,
      },
    };
  }`,
      ],
      [
        '  /** Money customers owe right now (not limited to a date range). */',
        `  /**
   * What uploaded statements say moved through the account in [range], plus the transactions those
   * rows already produced (so nothing is counted twice), and whether the file's own
   * opening + credits - debits = closing arithmetic holds.
   */
  async statementTotals(range: Range) {
    const businessId = requireBusinessId();
    const [rows, imports] = await Promise.all([
      this.prisma.importedTransaction.findMany({
        where: {
          import: { businessId },
          matchStatus: { notIn: ['INVALID', 'DUPLICATE'] },
          date: { gte: toDbDate(range.from), lte: toDbDate(range.to) },
          amount: { not: null },
        },
        select: { amount: true, direction: true },
      }),
      this.prisma.reconciliationImport.findMany({
        where: { businessId },
        orderBy: { createdAt: 'asc' },
        select: { openingBalance: true, closingBalance: true },
      }),
    ]);
    let credits = new Decimal(0);
    let debits = new Decimal(0);
    for (const r of rows) {
      if (!r.amount) continue;
      if (r.direction === 'IN') credits = credits.plus(D(r.amount));
      else if (r.direction === 'OUT') debits = debits.plus(D(r.amount));
    }
    const createdIds = (
      await this.prisma.importedTransaction.findMany({
        where: { import: { businessId }, createdTransactionId: { not: null } },
        select: { createdTransactionId: true },
      })
    ).flatMap((r) => (r.createdTransactionId ? [r.createdTransactionId] : []));
    const created = createdIds.length
      ? await this.prisma.transaction.groupBy({
          by: ['type'],
          where: { id: { in: createdIds } },
          _sum: { amount: true },
        })
      : [];
    const createdSum = (type: 'INCOME' | 'EXPENSE') =>
      D(created.find((c) => c.type === type)?._sum.amount ?? 0);
    const opening =
      imports.find((i) => i.openingBalance !== null)?.openingBalance ?? null;
    const closing =
      [...imports].reverse().find((i) => i.closingBalance !== null)
        ?.closingBalance ?? null;
    return {
      credits,
      debits,
      net: credits.minus(debits),
      openingBalance: opening ? D(opening) : null,
      closingBalance: closing ? D(closing) : null,
      reconciles:
        opening && closing
          ? D(opening).plus(credits).minus(debits).equals(D(closing))
          : null,
      importCount: imports.length,
      rowCount: rows.length,
      createdTransactions: {
        income: createdSum('INCOME'),
        expense: createdSum('EXPENSE'),
      },
    };
  }

  /** Daily money in/out and the running balance taken from uploaded statements. */
  async cashflow(range: Range) {
    const businessId = requireBusinessId();
    const [imports, rows] = await Promise.all([
      this.prisma.reconciliationImport.findMany({
        where: { businessId },
        orderBy: { createdAt: 'asc' },
        select: { openingBalance: true },
      }),
      this.prisma.importedTransaction.findMany({
        where: {
          import: { businessId },
          matchStatus: { notIn: ['INVALID', 'DUPLICATE'] },
          date: { not: null },
          amount: { not: null },
          direction: { not: null },
        },
        select: { date: true, amount: true, direction: true },
        orderBy: { date: 'asc' },
      }),
    ]);
    const opening = imports.find((i) => i.openingBalance !== null)
      ?.openingBalance;
    const daily = new Map<string, { in: Decimal; out: Decimal }>();
    for (const r of rows) {
      if (!r.date || !r.amount) continue;
      const d = isoDate(r.date);
      const e = daily.get(d) ?? { in: new Decimal(0), out: new Decimal(0) };
      if (r.direction === 'IN') e.in = e.in.plus(D(r.amount));
      else if (r.direction === 'OUT') e.out = e.out.plus(D(r.amount));
      daily.set(d, e);
    }
    let running = opening ? D(opening) : new Decimal(0);
    for (const [d, v] of [...daily.entries()].sort())
      if (d < range.from) running = running.plus(v.in).minus(v.out);
    const points: {
      date: string;
      in: string;
      out: string;
      net: string;
      balance: string;
    }[] = [];
    for (let d = range.from; d <= range.to; d = addDaysIso(d, 1)) {
      const v = daily.get(d);
      if (v) running = running.plus(v.in).minus(v.out);
      points.push({
        date: d,
        in: money(v?.in ?? 0),
        out: money(v?.out ?? 0),
        net: money((v?.in ?? new Decimal(0)).minus(v?.out ?? 0)),
        balance: money(running),
      });
    }
    return {
      from: range.from,
      to: range.to,
      openingBalance: opening ? money(D(opening)) : null,
      openingKnown: Boolean(opening),
      closingBalance: money(running),
      points,
    };
  }

  /** Money customers owe right now (not limited to a date range). */`,
      ],
      [
        `    const [summary, owing, recent] = await Promise.all([
      this.summary({ from: today, to: today }),
      this.customersOwing(),`,
        `    const thirtyDaysBack = addDaysIso(today, -29);
    const [summary, owing, recent, statement, cashflow] = await Promise.all([
      this.summary({ from: today, to: today }),
      this.customersOwing(),
      this.prisma.transaction.findMany({
        where: { businessId: requireBusinessId() },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        take: 10,
        include: {
          customer: { select: { name: true } },
          invoicePayment: { select: { invoiceId: true } },
        },
      }),
      this.statementTotals({ from: thirtyDaysBack, to: today }),
      this.cashflow({ from: thirtyDaysBack, to: today }),
    ]);
    const unused = [`,
      ],
    ],
  },
];

let failures = 0;
for (const edit of edits) {
  let src = readFileSync(edit.file, 'utf8').replace(/\r\n/g, '\n');
  for (const [from, to] of edit.pairs) {
    if (src.includes(to.split('\n')[0]) && !src.includes(from)) {
      console.log(`skip (already applied): ${edit.file} :: ${from.split('\n')[0].slice(0, 50)}`);
      continue;
    }
    if (!src.includes(from)) {
      console.error(`MISSING: ${edit.file} :: ${from.split('\n')[0].slice(0, 70)}`);
      failures++;
      continue;
    }
    src = src.replace(from, to);
  }
  writeFileSync(edit.file, src);
}
console.log(failures === 0 ? 'PATCHES_OK' : `PATCH_FAILURES=${failures}`);
