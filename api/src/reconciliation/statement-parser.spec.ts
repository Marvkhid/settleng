import {
  duplicateKey,
  markDuplicates,
  MAX_ROWS,
  parseAmount,
  parseDate,
  parseStatement,
  SAMPLE_CSV,
} from './statement-parser';

const TODAY = '2026-10-04';

describe('parseAmount', () => {
  it.each([
    ['25,000.50', '25000.5', false],
    ['₦1,200', '1200', false],
    ['NGN 500', '500', false],
    ['-300', '300', true],
    ['(450.00)', '450', true],
  ])('reads %s', (raw, val, neg) => {
    const r = parseAmount(raw)!;
    expect(r.value.toString()).toBe(val);
    expect(r.negative).toBe(neg);
  });
  it.each(['abc', '', '0', '12.345', '1e5', '12,34,5x'])('rejects %j', (raw) =>
    expect(parseAmount(raw)).toBeNull(),
  );
});

describe('parseDate', () => {
  it('reads ISO and day-first Nigerian formats', () => {
    expect(parseDate('2026-10-01', TODAY)).toBe('2026-10-01');
    expect(parseDate('01/10/2026', TODAY)).toBe('2026-10-01');
    expect(parseDate('1-9-2026', TODAY)).toBe('2026-09-01');
    expect(parseDate('2026-10-01 14:30:00', TODAY)).toBe('2026-10-01');
  });
  it('rejects impossible, future and ancient dates', () => {
    for (const bad of [
      '2026-02-30',
      '31/04/2026',
      '2026-10-05',
      '1999-12-31',
      'yesterday',
      '',
    ])
      expect(parseDate(bad, TODAY)).toBeNull();
  });
});

describe('parseStatement', () => {
  it('parses the downloadable sample template cleanly', () => {
    const r = parseStatement(SAMPLE_CSV, TODAY);
    expect(r.problems).toEqual([]);
    expect(r.rows).toHaveLength(3);
    expect(r.rows.every((x) => x.status === 'VALID')).toBe(true);
    expect(r.rows.map((x) => x.direction)).toEqual(['IN', 'IN', 'OUT']);
  });

  it('flags invalid rows with a plain-English note and keeps going', () => {
    const csv =
      'Date,Narration,Amount\n2026-10-01,ok,1000\nnot a date,bad date,500\n2026-10-02,bad amount,abc\n';
    const r = parseStatement(csv, TODAY);
    expect(r.rows.map((x) => x.status)).toEqual([
      'VALID',
      'INVALID',
      'INVALID',
    ]);
    expect(r.rows[1].note).toMatch(/date/i);
    expect(r.rows[2].note).toMatch(/amount/i);
  });

  it('uses the sign of the amount when there is no direction column', () => {
    const r = parseStatement(
      'Date,Description,Amount\n2026-10-01,a,1000\n2026-10-01,b,-500\n',
      TODAY,
    );
    expect(r.rows.map((x) => x.direction)).toEqual(['IN', 'OUT']);
  });

  it('supports separate Credit / Debit columns and rejects rows with both', () => {
    const csv =
      'Date,Narration,Debit,Credit\n2026-10-01,in,,5000\n2026-10-01,out,700,\n2026-10-01,both,10,10\n';
    const r = parseStatement(csv, TODAY);
    expect(r.rows.map((x) => [x.direction, x.status])).toEqual([
      ['IN', 'VALID'],
      ['OUT', 'VALID'],
      [null, 'INVALID'],
    ]);
  });

  it('marks unknown direction words invalid', () => {
    const r = parseStatement('Date,Amount,Type\n2026-10-01,100,maybe\n', TODAY);
    expect(r.rows[0].status).toBe('INVALID');
  });

  it('reports missing columns instead of guessing', () => {
    const r = parseStatement('Foo,Bar\n1,2\n', TODAY);
    expect(r.problems.join(' ')).toMatch(/date/i);
    expect(r.rows).toEqual([]);
  });

  it('accepts a manual column mapping and rejects columns that do not exist', () => {
    const csv = 'When,What,How much\n2026-10-01,x,300\n';
    expect(parseStatement(csv, TODAY).problems.length).toBeGreaterThan(0);
    const ok = parseStatement(csv, TODAY, {
      date: 'When',
      description: 'What',
      amount: 'How much',
    });
    expect(ok.problems).toEqual([]);
    expect(ok.rows[0].amount).toBe('300.00');
    expect(
      parseStatement(csv, TODAY, {
        date: 'Nope',
        amount: 'How much',
      }).problems.join(' '),
    ).toMatch(/not in the file/);
  });

  it('enforces the row limit and handles BOM / empty files', () => {
    const big =
      'Date,Amount\n' +
      Array.from({ length: MAX_ROWS + 1 }, () => '2026-10-01,100').join('\n');
    expect(parseStatement(big, TODAY).problems.join(' ')).toMatch(/more than/);
    expect(parseStatement('Date,Amount\n', TODAY).problems.join(' ')).toMatch(
      /no data/i,
    );
    expect(
      parseStatement('\uFEFFDate,Amount\n2026-10-01,5\n', TODAY).problems,
    ).toEqual([]);
  });

  it('does not execute or reinterpret spreadsheet formulas; they stay plain text', () => {
    const r = parseStatement(
      'Date,Description,Amount\n2026-10-01,=HYPERLINK("x"),100\n',
      TODAY,
    );
    expect(r.rows[0].description).toBe('=HYPERLINK("x")');
  });
});

describe('duplicate detection', () => {
  const rows = () =>
    parseStatement(
      'Date,Description,Amount,Reference\n2026-10-01,A,100,R1\n2026-10-01,B,200,R1\n2026-10-02,C,300,\n2026-10-02,C,300,\n',
      TODAY,
    ).rows;

  it('flags a repeated reference and a repeated reference-less row inside the file', () => {
    const out = markDuplicates(rows(), new Set());
    expect(out.map((r) => r.status)).toEqual([
      'VALID',
      'DUPLICATE',
      'VALID',
      'DUPLICATE',
    ]);
  });

  it('flags rows already imported before', () => {
    const first = rows()[0];
    const out = markDuplicates(
      rows().slice(0, 1),
      new Set([duplicateKey(first)]),
    );
    expect(out[0].status).toBe('DUPLICATE');
    expect(out[0].note).toMatch(/already imported/i);
  });

  it('never turns an invalid row into a duplicate', () => {
    const bad = parseStatement('Date,Amount\nnope,5\nnope,5\n', TODAY).rows;
    expect(
      markDuplicates(bad, new Set()).every((r) => r.status === 'INVALID'),
    ).toBe(true);
  });
});
