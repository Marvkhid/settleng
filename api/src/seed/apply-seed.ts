import { Prisma } from '../generated/prisma/client';
import { buildSeedData } from './seed-data';

type Tx = Prisma.TransactionClient;
const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

/**
 * Restores the demo business to its original state inside the given transaction.
 * Safe to run repeatedly: it clears the business's rows (children first) and recreates them
 * with fixed ids, so running it twice never duplicates data.
 */
export async function applySeed(
  tx: Tx,
  today: string,
  opts: { audit?: string } = {},
) {
  const data = buildSeedData(today);
  const businessId = data.business.id;

  await tx.transaction.deleteMany({ where: { businessId } });
  await tx.importedTransaction.deleteMany({
    where: { import: { businessId } },
  });
  await tx.reconciliationImport.deleteMany({ where: { businessId } });
  await tx.invoicePayment.deleteMany({ where: { invoice: { businessId } } });
  await tx.invoiceItem.deleteMany({ where: { invoice: { businessId } } });
  await tx.invoice.deleteMany({ where: { businessId } });
  await tx.customer.deleteMany({ where: { businessId } });
  await tx.auditEvent.deleteMany({ where: { businessId } });

  await tx.business.upsert({
    where: { id: businessId },
    update: { name: data.business.name, currency: data.business.currency },
    create: data.business,
  });
  await tx.customer.createMany({
    data: data.customers.map((c) => ({ ...c, businessId })),
  });
  await tx.invoice.createMany({
    data: data.invoices.map((i) => ({
      ...i,
      businessId,
      issueDate: d(i.issueDate),
      dueDate: d(i.dueDate),
    })),
  });
  await tx.invoiceItem.createMany({ data: data.items });
  await tx.invoicePayment.createMany({
    data: data.payments.map((p) => ({ ...p, paymentDate: d(p.paymentDate) })),
  });
  await tx.transaction.createMany({
    data: data.transactions.map((t) => ({ ...t, businessId, date: d(t.date) })),
  });
  await tx.reconciliationImport.createMany({
    data: data.imports.map((i) => ({ ...i, businessId })),
  });
  await tx.importedTransaction.createMany({
    data: data.importedRows.map((r) => ({
      ...r,
      date: r.date ? d(r.date) : null,
    })),
  });
  await tx.auditEvent.create({
    data: {
      businessId,
      action: opts.audit ? 'DEMO_RESET' : 'DEMO_SEED',
      entityType: 'Business',
      entityId: businessId,
      summary: opts.audit ?? 'Sample data loaded',
    },
  });
  return {
    customers: data.customers.length,
    invoices: data.invoices.length,
    payments: data.payments.length,
    transactions: data.transactions.length,
    imports: data.imports.length,
    importedRows: data.importedRows.length,
  };
}

export const todayUtc = () => new Date().toISOString().slice(0, 10);
