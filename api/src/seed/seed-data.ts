/**
 * Deterministic sample data for "Adeola Mini Mart" (fictional).
 * Pure function: same `today` in, same data out. Amounts are whole naira.
 * IDs are fixed so the seed and demo reset are repeatable (upsert / delete+recreate).
 */
export type Method = 'CASH' | 'BANK_TRANSFER' | 'POS' | 'CREDIT';
export type MatchStatusValue =
  | 'VALID'
  | 'INVALID'
  | 'DUPLICATE'
  | 'UNMATCHED'
  | 'SUGGESTED_MATCH'
  | 'MATCHED';

export interface SeedData {
  business: { id: string; name: string; currency: string };
  customers: {
    id: string;
    name: string;
    email: string | null;
    phone: string;
    notes: string | null;
  }[];
  invoices: {
    id: string;
    customerId: string;
    invoiceNumber: string;
    issueDate: string;
    dueDate: string;
    isDraft: boolean;
  }[];
  items: {
    id: string;
    invoiceId: string;
    description: string;
    quantity: number;
    unitPrice: number;
  }[];
  payments: {
    id: string;
    invoiceId: string;
    amount: number;
    paymentDate: string;
    method: Method;
    reference: string | null;
  }[];
  transactions: {
    id: string;
    customerId: string | null;
    type: 'INCOME' | 'EXPENSE';
    source: 'MANUAL' | 'INVOICE_PAYMENT';
    paymentMethod: Method | null;
    amount: number;
    category: string;
    date: string;
    description: string;
    reference: string | null;
    invoicePaymentId: string | null;
  }[];
  imports: {
    id: string;
    filename: string;
    status: 'PENDING_REVIEW' | 'COMPLETED';
    rowCount: number;
  }[];
  importedRows: {
    id: string;
    importId: string;
    externalReference: string | null;
    date: string | null;
    description: string | null;
    amount: number | null;
    direction: 'IN' | 'OUT' | null;
    matchStatus: MatchStatusValue;
    matchedInvoiceId: string | null;
    suggestedInvoiceId: string | null;
    rawRowNumber: number;
    note: string | null;
  }[];
}

export const DEMO_BUSINESS_ID = 'demo-business';

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const pad = (n: number, w = 2) => String(n).padStart(w, '0');
const roundTo = (n: number, step: number) => Math.round(n / step) * step;

/** Small deterministic PRNG (mulberry32) so "random-looking" amounts never change between runs. */
function rng(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CUSTOMERS: [string, string | null, string, string | null][] = [
  ['Mama Nkechi Stores', null, '08030000001', 'Buys provisions weekly'],
  ['Chief Okafor', 'chief.okafor@example.com', '08030000002', null],
  [
    'Bisi Fashion House',
    'bisi@example.com',
    '08030000003',
    'Pays at month end',
  ],
  ["Tunde's Barbing Salon", null, '08030000004', null],
  ['Hajiya Aisha Foods', null, '08030000005', 'Bulk orders before weekends'],
  ['Emeka Auto Spares', 'emeka@example.com', '08030000006', null],
  ['Folake Catering', 'folake@example.com', '08030000007', 'Events orders'],
  ['Mr Ibrahim Yusuf', null, '08030000008', null],
  ['Ngozi Beauty Hub', 'ngozi@example.com', '08030000009', null],
  ['Sunday Adewale', null, '08030000010', 'Neighbour, pays in instalments'],
  ['Blessing Bakery', null, '08030000011', null],
  ['Kola Logistics', 'kola@example.com', '08030000012', 'Office supplies'],
];

const PRODUCTS: [string, number][] = [
  ['Carton of Indomie noodles', 7200],
  ['Bag of rice (50kg)', 82000],
  ['Crate of eggs', 4300],
  ['Carton of sachet water', 1900],
  ['Peak milk (tin, dozen)', 9800],
  ['Vegetable oil (25L)', 52000],
  ['Sugar (bag)', 61000],
  ['Tin tomato (carton)', 14500],
  ['Soft drinks (crate)', 5200],
  ['Detergent (carton)', 18500],
];

/** Plan per invoice index: kind and number of payments. 25 invoices. */
type Kind =
  'DRAFT' | 'PAID' | 'PARTIAL' | 'UNPAID' | 'OVERDUE' | 'OVERDUE_PARTIAL';
const PLAN: Kind[] = [
  'PAID',
  'PAID',
  'PAID',
  'PAID',
  'PAID',
  'PAID',
  'PAID',
  'PARTIAL',
  'PARTIAL',
  'PARTIAL',
  'PARTIAL',
  'PARTIAL',
  'PARTIAL',
  'UNPAID',
  'UNPAID',
  'UNPAID',
  'UNPAID',
  'UNPAID',
  'OVERDUE',
  'OVERDUE',
  'OVERDUE_PARTIAL',
  'OVERDUE_PARTIAL',
  'DRAFT',
  'DRAFT',
  'DRAFT',
];

export function buildSeedData(today: string): SeedData {
  const rand = rng(20261004);
  const methods: Method[] = ['CASH', 'BANK_TRANSFER', 'POS', 'BANK_TRANSFER'];
  const id = (p: string, n: number, w = 2) => `demo-${p}-${pad(n, w)}`;

  const customers = CUSTOMERS.map(([name, email, phone, notes], i) => ({
    id: id('cust', i + 1),
    name,
    email,
    phone,
    notes,
  }));

  const invoices: SeedData['invoices'] = [];
  const items: SeedData['items'] = [];
  const payments: SeedData['payments'] = [];
  const invoiceTotals = new Map<string, number>();

  PLAN.forEach((kind, i) => {
    const n = i + 1;
    const invId = id('inv', n);
    // Issue/due dates chosen so the planned status holds for any `today`.
    let issueAgo: number;
    let termDays: number;
    switch (kind) {
      case 'PAID':
        issueAgo = 20 + i * 11;
        termDays = 14;
        break;
      case 'PARTIAL':
        issueAgo = 3 + (i % 6) * 2;
        termDays = 30;
        break; // not yet due
      case 'UNPAID':
        issueAgo = 1 + (i % 5);
        termDays = 21;
        break; // not yet due
      case 'OVERDUE':
        issueAgo = 45 + (i % 2) * 15;
        termDays = 14;
        break;
      case 'OVERDUE_PARTIAL':
        issueAgo = 50 + (i % 2) * 20;
        termDays = 14;
        break;
      default:
        issueAgo = i % 4;
        termDays = 14; // DRAFT
    }
    const issueDate = addDays(today, -issueAgo);
    const dueDate = addDays(issueDate, termDays);
    invoices.push({
      id: invId,
      customerId: customers[i % customers.length].id,
      invoiceNumber: `AMM-${pad(n, 4)}`,
      issueDate,
      dueDate,
      isDraft: kind === 'DRAFT',
    });

    let total = 0;
    for (let k = 0; k < 2; k++) {
      const [description, price] = PRODUCTS[(i * 2 + k) % PRODUCTS.length];
      const quantity = 1 + Math.floor(rand() * 4);
      total += quantity * price;
      items.push({
        id: `${invId}-item-${k + 1}`,
        invoiceId: invId,
        description,
        quantity,
        unitPrice: price,
      });
    }
    invoiceTotals.set(invId, total);

    const pay = (seq: number, amount: number, daysAfterIssue: number) => {
      const paymentDate = addDays(issueDate, daysAfterIssue);
      payments.push({
        id: `${invId}-pay-${seq}`,
        invoiceId: invId,
        amount,
        paymentDate: paymentDate > today ? today : paymentDate,
        method: methods[(i + seq) % methods.length],
        reference: seq === 1 ? `RCPT-${pad(n, 4)}` : `RCPT-${pad(n, 4)}-${seq}`,
      });
    };
    if (kind === 'PAID') {
      if (i % 2 === 0) pay(1, total, 5);
      else {
        const first = roundTo(total * 0.6, 100);
        pay(1, first, 3);
        pay(2, total - first, 9);
      }
    } else if (kind === 'PARTIAL') {
      const first = roundTo(total * 0.4, 100);
      if (i % 2 === 0) pay(1, first, 1);
      else {
        pay(1, first, 1);
        pay(2, roundTo(total * 0.2, 100), 2);
      }
    } else if (kind === 'OVERDUE_PARTIAL') {
      pay(1, roundTo(total * 0.3, 100), 6);
    }
  });

  const transactions: SeedData['transactions'] = [];
  // 1) One income transaction per invoice payment (traceable to the payment).
  payments.forEach((p, idx) => {
    const inv = invoices.find((x) => x.id === p.invoiceId)!;
    transactions.push({
      id: id('txn-pay', idx + 1, 3),
      customerId: inv.customerId,
      type: 'INCOME',
      source: 'INVOICE_PAYMENT',
      paymentMethod: p.method,
      amount: p.amount,
      category: 'Customer payment',
      date: p.paymentDate,
      description: `Payment for ${inv.invoiceNumber}`,
      reference: p.reference,
      invoicePaymentId: p.id,
    });
  });
  // 2) Daily manual sales and regular expenses for the last 60 days.
  const expenseCats: [string, string, number, number][] = [
    ['Stock', 'Bought stock', 20000, 90000],
    ['Transport', 'Transport for deliveries', 2500, 9000],
    ['Utilities', 'Electricity token', 5000, 15000],
    ['Wages', 'Shop assistant pay', 15000, 30000],
    ['Rent', 'Shop rent contribution', 25000, 40000],
    ['Other', 'Packaging and bags', 2000, 7000],
  ];
  for (let d = 0; d < 60; d++) {
    const date = addDays(today, -d);
    transactions.push({
      id: id('txn-sale', d + 1, 3),
      customerId: null,
      type: 'INCOME',
      source: 'MANUAL',
      paymentMethod: methods[d % methods.length],
      amount: roundTo(18000 + rand() * 77000, 500),
      category: 'Sales',
      date,
      description: 'Daily shop sales',
      reference: null,
      invoicePaymentId: null,
    });
    if (d % 2 === 0) {
      const [category, description, lo, hi] =
        expenseCats[(d / 2) % expenseCats.length];
      transactions.push({
        id: id('txn-exp', d / 2 + 1, 3),
        customerId: null,
        type: 'EXPENSE',
        source: 'MANUAL',
        paymentMethod: methods[(d + 1) % methods.length],
        amount: roundTo(lo + rand() * (hi - lo), 500),
        category,
        date,
        description,
        reference: null,
        invoicePaymentId: null,
      });
    }
  }

  // 3) Three CSV imports with matchable, unmatched, duplicate and invalid rows.
  const imports: SeedData['imports'] = [];
  const importedRows: SeedData['importedRows'] = [];
  const paidInvoices = PLAN.map((k, i) => ({ k, i })).filter(
    (x) => x.k === 'PAID',
  );
  const openInvoices = PLAN.map((k, i) => ({ k, i })).filter(
    (x) => x.k === 'OVERDUE' || x.k === 'UNPAID' || x.k === 'PARTIAL',
  );
  const importPlan = [
    {
      id: 'demo-import-1',
      filename: 'transfers-august.csv',
      status: 'COMPLETED' as const,
      rows: 14,
    },
    {
      id: 'demo-import-2',
      filename: 'pos-settlement-september.csv',
      status: 'PENDING_REVIEW' as const,
      rows: 12,
    },
    {
      id: 'demo-import-3',
      filename: 'bank-export-october.csv',
      status: 'PENDING_REVIEW' as const,
      rows: 14,
    },
  ];
  importPlan.forEach((imp, impIdx) => {
    imports.push({
      id: imp.id,
      filename: imp.filename,
      status: imp.status,
      rowCount: imp.rows,
    });
    for (let r = 0; r < imp.rows; r++) {
      const rowId = `${imp.id}-row-${pad(r + 1)}`;
      const ref = `REF${impIdx + 1}${pad(r + 1, 3)}`;
      const date = addDays(today, -(2 + r * 2 + impIdx * 3));
      const base = {
        id: rowId,
        importId: imp.id,
        rawRowNumber: r + 1,
        matchedInvoiceId: null as string | null,
        suggestedInvoiceId: null as string | null,
        note: null as string | null,
      };
      const mod = r % 7;
      if (mod === 0 && imp.status === 'COMPLETED') {
        const inv = paidInvoices[(r + impIdx) % paidInvoices.length];
        const pay = payments.find((p) => p.invoiceId === id('inv', inv.i + 1))!;
        importedRows.push({
          ...base,
          externalReference: ref,
          date,
          description: `Transfer from customer ${inv.i + 1}`,
          amount: pay.amount,
          direction: 'IN',
          matchStatus: 'MATCHED',
          matchedInvoiceId: pay.invoiceId,
        });
      } else if (mod === 1 && openInvoices.length) {
        const inv = openInvoices[(r + impIdx) % openInvoices.length];
        const invId = id('inv', inv.i + 1);
        const paid = payments
          .filter((p) => p.invoiceId === invId)
          .reduce((s, p) => s + p.amount, 0);
        importedRows.push({
          ...base,
          externalReference: ref,
          date,
          description: `Payment ${invoices[inv.i].invoiceNumber}`,
          amount: (invoiceTotals.get(invId) ?? 0) - paid,
          direction: 'IN',
          matchStatus: 'SUGGESTED_MATCH',
          suggestedInvoiceId: invId,
        });
      } else if (mod === 3 && r > 0) {
        const prev = importedRows[importedRows.length - 1];
        importedRows.push({
          ...base,
          externalReference: prev.externalReference,
          date: prev.date,
          description: prev.description,
          amount: prev.amount,
          direction: prev.direction,
          matchStatus: 'DUPLICATE',
          note: 'Same reference as the row above',
        });
      } else if (mod === 5) {
        importedRows.push({
          ...base,
          externalReference: ref,
          date: null,
          description: 'Unreadable row',
          amount: null,
          direction: null,
          matchStatus: 'INVALID',
          note: 'Date or amount could not be read',
        });
      } else if (mod === 6) {
        importedRows.push({
          ...base,
          externalReference: ref,
          date,
          description: 'Airtime / data purchase',
          amount: roundTo(500 + rand() * 4500, 100),
          direction: 'OUT',
          matchStatus: 'VALID',
        });
      } else {
        importedRows.push({
          ...base,
          externalReference: ref,
          date,
          description: 'Unknown transfer',
          amount: roundTo(3000 + rand() * 40000, 500),
          direction: 'IN',
          matchStatus: 'UNMATCHED',
        });
      }
    }
  });

  return {
    business: {
      id: DEMO_BUSINESS_ID,
      name: 'Adeola Mini Mart',
      currency: 'NGN',
    },
    customers,
    invoices,
    items,
    payments,
    transactions,
    imports,
    importedRows,
  };
}
