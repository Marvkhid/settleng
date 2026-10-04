import {
  invoiceBalance,
  invoiceStatus,
  invoiceTotal,
  InvoiceLike,
} from './invoice-status';

const base = (over: Partial<InvoiceLike> = {}): InvoiceLike => ({
  isDraft: false,
  voidedAt: null,
  dueDate: '2026-10-20',
  items: [
    { quantity: '2', unitPrice: '1500.10' },
    { quantity: '1', unitPrice: '999.90' },
  ],
  payments: [],
  ...over,
});

describe('invoice money and status', () => {
  const today = '2026-10-04';

  it('totals with exact decimals (no float drift)', () => {
    expect(invoiceTotal(base().items).toString()).toBe('4000.1');
    expect(invoiceTotal([{ quantity: '3', unitPrice: '0.1' }]).toString()).toBe(
      '0.3',
    );
  });

  it('is UNPAID with no payments and not yet due', () => {
    expect(invoiceStatus(base(), today)).toBe('UNPAID');
  });

  it('is PARTIALLY_PAID after a partial payment', () => {
    expect(invoiceStatus(base({ payments: [{ amount: '1000' }] }), today)).toBe(
      'PARTIALLY_PAID',
    );
  });

  it('is PAID after multiple installments reach the total', () => {
    const inv = base({ payments: [{ amount: '1000' }, { amount: '3000.10' }] });
    expect(invoiceStatus(inv, today)).toBe('PAID');
    expect(invoiceBalance(inv).toString()).toBe('0');
  });

  it('is OVERDUE when past due and not fully paid, even if partly paid', () => {
    expect(invoiceStatus(base({ dueDate: '2026-10-01' }), today)).toBe(
      'OVERDUE',
    );
    expect(
      invoiceStatus(
        base({ dueDate: '2026-10-01', payments: [{ amount: '5' }] }),
        today,
      ),
    ).toBe('OVERDUE');
  });

  it('stays PAID when fully paid after the due date', () => {
    const inv = base({
      dueDate: '2026-09-01',
      payments: [{ amount: '4000.10' }],
    });
    expect(invoiceStatus(inv, today)).toBe('PAID');
  });

  it('is not overdue on the due date itself', () => {
    expect(invoiceStatus(base({ dueDate: today }), today)).toBe('UNPAID');
  });

  it('DRAFT and VOID take precedence', () => {
    expect(
      invoiceStatus(base({ isDraft: true, dueDate: '2020-01-01' }), today),
    ).toBe('DRAFT');
    expect(
      invoiceStatus(base({ voidedAt: new Date(), isDraft: true }), today),
    ).toBe('VOID');
  });
});
