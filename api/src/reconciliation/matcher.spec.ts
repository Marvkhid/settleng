import Decimal from 'decimal.js';
import { suggestMatches, OpenInvoice } from './matcher';

const inv = (
  id: string,
  no: string,
  name: string,
  bal: string,
  issue = '2026-09-01',
): OpenInvoice => ({
  id,
  invoiceNumber: no,
  customerName: name,
  balance: new Decimal(bal),
  issueDate: issue,
});

describe('suggestMatches', () => {
  const invoices = [
    inv('a', 'AMM-0014', 'Mama Nkechi Stores', '52000'),
    inv('b', 'AMM-0020', 'Chief Okafor', '30000'),
    inv('c', 'AMM-0021', 'Bisi Fashion House', '30000'),
  ];

  it('matches on invoice number mentioned in the description', () => {
    expect(
      suggestMatches(
        [
          {
            rowNumber: 1,
            description: 'TRF from Mama AMM 0014',
            amount: '10000',
          },
        ],
        invoices,
      ).get(1),
    ).toBe('a');
  });
  it('matches on exact balance plus customer name', () => {
    expect(
      suggestMatches(
        [
          {
            rowNumber: 1,
            description: 'Chief Okafor transfer',
            amount: '30000',
          },
        ],
        invoices,
      ).get(1),
    ).toBe('b');
  });
  it('does not suggest on weak evidence', () => {
    expect(
      suggestMatches(
        [{ rowNumber: 1, description: 'random', amount: '12345' }],
        invoices,
      ).size,
    ).toBe(0);
    expect(
      suggestMatches(
        [{ rowNumber: 1, description: 'Mama stores', amount: '10000' }],
        invoices,
      ).size,
    ).toBe(0);
  });
  it('never suggests an invoice for more than its balance', () => {
    expect(
      suggestMatches(
        [{ rowNumber: 1, description: 'AMM-0014', amount: '60000' }],
        invoices,
      ).size,
    ).toBe(0);
  });
  it('uses each invoice at most once', () => {
    const rows = [
      { rowNumber: 1, description: 'AMM-0014', amount: '52000' },
      { rowNumber: 2, description: 'AMM-0014', amount: '52000' },
    ];
    const m = suggestMatches(rows, invoices);
    expect(m.get(1)).toBe('a');
    expect(m.has(2)).toBe(false);
  });
  it('prefers the older invoice on equal evidence', () => {
    const m = suggestMatches(
      [{ rowNumber: 1, description: 'payment', amount: '30000' }],
      [
        inv('new', 'N-2', 'X Corp', '30000', '2026-10-01'),
        inv('old', 'N-1', 'Y Corp', '30000', '2026-08-01'),
      ],
    );
    expect(m.get(1)).toBe('old');
  });
});
