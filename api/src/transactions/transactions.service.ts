import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditService } from '../common/audit.service';
import { requireBusinessId } from '../common/business';
import { isoDate, isRealDate, todayInLagos, toDbDate } from '../common/dates';
import { D, money } from '../common/money';
import { Page, pageOf } from '../common/pagination';
import { Prisma } from '../generated/prisma/client';
import { InvoicesService } from '../invoices/invoices.service';
import { toInvoiceView, invoiceInclude } from '../invoices/invoice-view';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateTransactionDto,
  RecordExpenseDto,
  RecordSaleDto,
  TransactionListQuery,
  UpdateTransactionDto,
} from './transaction.dto';

export const EXPENSE_CATEGORIES = [
  'Stock',
  'Transport',
  'Utilities',
  'Wages',
  'Rent',
  'Other',
];
export const INCOME_CATEGORIES = ['Sales', 'Customer payment', 'Other income'];

const txnInclude = {
  customer: { select: { id: true, name: true } },
  invoicePayment: {
    select: { invoiceId: true, invoice: { select: { invoiceNumber: true } } },
  },
} satisfies Prisma.TransactionInclude;
type TxnRow = Prisma.TransactionGetPayload<{ include: typeof txnInclude }>;

export interface TransactionView {
  id: string;
  type: 'INCOME' | 'EXPENSE';
  source: 'MANUAL' | 'INVOICE_PAYMENT' | 'IMPORTED';
  sign: '+' | '-';
  amount: string;
  category: string;
  date: string;
  description: string | null;
  reference: string | null;
  paymentMethod: string | null;
  customer: { id: string; name: string } | null;
  invoice: { id: string; invoiceNumber: string } | null;
  editable: boolean;
}

export const toTransactionView = (t: TxnRow): TransactionView => ({
  id: t.id,
  type: t.type,
  source: t.source,
  sign: t.type === 'INCOME' ? '+' : '-',
  amount: money(D(t.amount)),
  category: t.category,
  date: isoDate(t.date),
  description: t.description,
  reference: t.reference,
  paymentMethod: t.paymentMethod,
  customer: t.customer,
  editable: t.source === 'MANUAL',
  invoice: t.invoicePayment
    ? {
        id: t.invoicePayment.invoiceId,
        invoiceNumber: t.invoicePayment.invoice.invoiceNumber,
      }
    : null,
});
export { txnInclude };

@Injectable()
export class TransactionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly invoices: InvoicesService,
  ) {}

  private dateOrToday(d?: string): string {
    const today = todayInLagos();
    const date = d ?? today;
    if (!isRealDate(date))
      throw new BadRequestException('Please enter a real date.');
    if (date > today)
      throw new BadRequestException('The date cannot be in the future.');
    return date;
  }

  private positive(amount: string) {
    if (D(amount).lte(0))
      throw new BadRequestException('The amount must be more than zero.');
  }

  async list(q: TransactionListQuery): Promise<Page<TransactionView>> {
    const where: Prisma.TransactionWhereInput = {
      businessId: requireBusinessId(),
    };
    if (q.type) where.type = q.type;
    if (q.source) where.source = q.source;
    if (q.category)
      where.category = { equals: q.category, mode: 'insensitive' };
    if (q.customerId) where.customerId = q.customerId;
    if (q.from || q.to)
      where.date = {
        ...(q.from ? { gte: toDbDate(q.from) } : {}),
        ...(q.to ? { lte: toDbDate(q.to) } : {}),
      };
    if (q.search)
      where.OR = [
        { description: { contains: q.search, mode: 'insensitive' } },
        { reference: { contains: q.search, mode: 'insensitive' } },
        { category: { contains: q.search, mode: 'insensitive' } },
        { customer: { name: { contains: q.search, mode: 'insensitive' } } },
      ];
    const [total, rows] = await Promise.all([
      this.prisma.transaction.count({ where }),
      this.prisma.transaction.findMany({
        where,
        include: txnInclude,
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
    ]);
    return pageOf(rows.map(toTransactionView), total, q);
  }

  async get(id: string): Promise<TransactionView> {
    const t = await this.prisma.transaction.findFirst({
      where: { id, businessId: requireBusinessId() },
      include: txnInclude,
    });
    if (!t) throw new NotFoundException('We could not find that record.');
    return toTransactionView(t);
  }

  async categories() {
    const rows = await this.prisma.transaction.findMany({
      where: { businessId: requireBusinessId() },
      distinct: ['type', 'category'],
      select: { type: true, category: true },
    });
    const merge = (base: string[], t: 'INCOME' | 'EXPENSE') =>
      [
        ...new Set([
          ...base,
          ...rows.filter((r) => r.type === t).map((r) => r.category),
        ]),
      ].sort((a, b) => a.localeCompare(b));
    return {
      expense: merge(EXPENSE_CATEGORIES, 'EXPENSE'),
      income: merge(INCOME_CATEGORIES, 'INCOME'),
    };
  }

  private async customerCheck(tx: Prisma.TransactionClient, id?: string) {
    if (!id) return;
    const c = await tx.customer.findFirst({
      where: { id, businessId: requireBusinessId() },
    });
    if (!c) throw new NotFoundException('We could not find that customer.');
  }

  async createManual(dto: CreateTransactionDto): Promise<TransactionView> {
    this.positive(dto.amount);
    const date = this.dateOrToday(dto.date);
    return this.prisma.$transaction(async (tx) => {
      await this.customerCheck(tx, dto.customerId);
      const t = await tx.transaction.create({
        data: {
          businessId: requireBusinessId(),
          type: dto.type,
          source: 'MANUAL',
          amount: D(dto.amount).toFixed(2),
          category: dto.category.trim(),
          date: toDbDate(date),
          description: dto.description?.trim() || null,
          reference: dto.reference?.trim() || null,
          paymentMethod: dto.paymentMethod ?? null,
          customerId: dto.customerId ?? null,
        },
        include: txnInclude,
      });
      await this.audit.record(tx, {
        action: 'TRANSACTION_CREATED',
        entityType: 'Transaction',
        entityId: t.id,
        summary: `${dto.type === 'INCOME' ? 'Income' : 'Expense'} of ₦${money(D(dto.amount))} recorded (${t.category})`,
      });
      return toTransactionView(t);
    });
  }

  /** "Record a sale": cash/transfer/POS becomes a sale record; Credit becomes a one-line invoice for the customer. */
  async recordSale(dto: RecordSaleDto) {
    this.positive(dto.amount);
    const date = this.dateOrToday(dto.date);
    if (dto.paymentMethod === 'CREDIT') {
      if (!dto.customerId)
        throw new BadRequestException(
          'Choose the customer who owes you for this credit sale.',
        );
      const inv = await this.prisma.$transaction((tx) =>
        this.invoices.createQuickCreditInvoice(tx, {
          customerId: dto.customerId!,
          amount: D(dto.amount).toFixed(2),
          description: dto.description?.trim() || 'Sale on credit',
          date,
        }),
      );
      const row = await this.prisma.invoice.findFirstOrThrow({
        where: { id: inv.id },
        include: invoiceInclude,
      });
      return {
        kind: 'credit_invoice' as const,
        invoice: toInvoiceView(row, todayInLagos()),
      };
    }
    const transaction = await this.prisma.$transaction(async (tx) => {
      await this.customerCheck(tx, dto.customerId);
      const t = await tx.transaction.create({
        data: {
          businessId: requireBusinessId(),
          type: 'INCOME',
          source: 'MANUAL',
          amount: D(dto.amount).toFixed(2),
          category: 'Sales',
          date: toDbDate(date),
          description: dto.description?.trim() || 'Sold goods',
          reference: dto.reference?.trim() || null,
          paymentMethod: dto.paymentMethod,
          customerId: dto.customerId ?? null,
        },
        include: txnInclude,
      });
      await this.audit.record(tx, {
        action: 'SALE_RECORDED',
        entityType: 'Transaction',
        entityId: t.id,
        summary: `Sale of ₦${money(D(dto.amount))} recorded`,
      });
      return toTransactionView(t);
    });
    return { kind: 'transaction' as const, transaction };
  }

  recordExpense(dto: RecordExpenseDto): Promise<TransactionView> {
    return this.createManual({
      type: 'EXPENSE',
      amount: dto.amount,
      category: dto.category,
      description: dto.description,
      date: dto.date,
      paymentMethod: dto.paymentMethod,
      reference: dto.reference,
    });
  }

  async update(
    id: string,
    dto: UpdateTransactionDto,
  ): Promise<TransactionView> {
    if (dto.amount !== undefined) this.positive(dto.amount);
    if (dto.date !== undefined) this.dateOrToday(dto.date);
    return this.prisma.$transaction(async (tx) => {
      const t = await tx.transaction.findFirst({
        where: { id, businessId: requireBusinessId() },
      });
      if (!t) throw new NotFoundException('We could not find that record.');
      if (t.source !== 'MANUAL')
        throw new BadRequestException(
          'This record comes from an invoice payment or an import, so it cannot be edited here.',
        );
      const u = await tx.transaction.update({
        where: { id },
        data: {
          amount: dto.amount ? D(dto.amount).toFixed(2) : undefined,
          category: dto.category?.trim(),
          date: dto.date ? toDbDate(dto.date) : undefined,
          description: dto.description,
          reference: dto.reference,
          paymentMethod: dto.paymentMethod,
        },
        include: txnInclude,
      });
      await this.audit.record(tx, {
        action: 'TRANSACTION_EDITED',
        entityType: 'Transaction',
        entityId: id,
        summary: `Record edited (${u.category}, ₦${money(D(u.amount))})`,
      });
      return toTransactionView(u);
    });
  }

  async remove(id: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const t = await tx.transaction.findFirst({
        where: { id, businessId: requireBusinessId() },
      });
      if (!t) throw new NotFoundException('We could not find that record.');
      if (t.source !== 'MANUAL')
        throw new BadRequestException(
          'Records linked to invoice payments or imports cannot be deleted.',
        );
      await tx.transaction.delete({ where: { id } });
      await this.audit.record(tx, {
        action: 'TRANSACTION_DELETED',
        entityType: 'Transaction',
        entityId: id,
        summary: `Record deleted (${t.category}, ₦${money(D(t.amount))})`,
      });
    });
  }
}
