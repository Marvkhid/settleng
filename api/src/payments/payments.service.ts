import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import Decimal from 'decimal.js';
import { AuditService } from '../common/audit.service';
import { BUSINESS_ID } from '../common/business';
import { isRealDate, isoDate, todayInLagos, toDbDate } from '../common/dates';
import { D, money } from '../common/money';
import { Prisma } from '../generated/prisma/client';
import {
  computeInvoice,
  invoiceInclude,
  InvoiceView,
  toInvoiceView,
} from '../invoices/invoice-view';
import { PrismaService } from '../prisma/prisma.service';
import { ReceivableMethod, RecordPaymentDto } from './payment.dto';

type Db = Prisma.TransactionClient;

export interface PaymentInput {
  invoiceId: string;
  amount: string;
  paymentDate?: string;
  method: ReceivableMethod;
  reference?: string;
  /** Set when the payment comes from a confirmed CSV match. */
  importedTransactionId?: string;
}

const DUPLICATE_WINDOW_MS = 15_000;

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Records one payment inside the caller's database transaction. Locks the invoice row first so two
   * simultaneous payments cannot both spend the same remaining balance.
   */
  async recordInTx(tx: Db, input: PaymentInput) {
    const today = todayInLagos();
    const date = input.paymentDate ?? today;
    const amount = D(input.amount);
    if (!isRealDate(date))
      throw new BadRequestException('Please enter a real payment date.');
    if (date > today)
      throw new BadRequestException(
        'The payment date cannot be in the future.',
      );
    if (amount.lte(0))
      throw new BadRequestException(
        'The payment amount must be more than zero.',
      );
    const reference = input.reference?.trim() || null;

    await tx.$queryRaw`SELECT "id" FROM "Invoice" WHERE "id" = ${input.invoiceId} AND "businessId" = ${BUSINESS_ID} FOR UPDATE`;
    const row = await tx.invoice.findFirst({
      where: { id: input.invoiceId, businessId: BUSINESS_ID },
      include: invoiceInclude,
    });
    if (!row) throw new NotFoundException('We could not find that invoice.');
    if (row.voidedAt)
      throw new BadRequestException(
        'This invoice is void, so it cannot take payments.',
      );
    if (row.isDraft)
      throw new BadRequestException(
        'This invoice is still a draft. Issue it before recording payments.',
      );
    if (date < isoDate(row.issueDate))
      throw new BadRequestException(
        'The payment date cannot be before the invoice was issued.',
      );

    const { balance } = computeInvoice(row, today);
    if (balance.lte(0))
      throw new ConflictException('This invoice is already fully paid.');
    if (amount.gt(balance))
      throw new BadRequestException(
        `This is more than the ₦${money(balance)} still owed on ${row.invoiceNumber}.`,
      );

    if (reference) {
      if (row.payments.some((p) => p.reference === reference))
        throw new ConflictException(
          'A payment with this reference is already recorded for this invoice.',
        );
    } else {
      const recent = row.payments.find(
        (p) =>
          D(p.amount).eq(amount) &&
          isoDate(p.paymentDate) === date &&
          p.method === input.method &&
          Date.now() - p.createdAt.getTime() < DUPLICATE_WINDOW_MS,
      );
      if (recent)
        throw new ConflictException(
          'This looks like the same payment you just recorded, so we did not save it twice.',
        );
    }

    const payment = await tx.invoicePayment.create({
      data: {
        invoiceId: row.id,
        amount: amount.toFixed(2),
        paymentDate: toDbDate(date),
        method: input.method,
        reference,
      },
    });
    const txn = await tx.transaction.create({
      data: {
        businessId: BUSINESS_ID,
        customerId: row.customerId,
        type: 'INCOME',
        source: input.importedTransactionId ? 'IMPORTED' : 'INVOICE_PAYMENT',
        paymentMethod: input.method,
        amount: amount.toFixed(2),
        category: 'Customer payment',
        date: toDbDate(date),
        description: `Payment for ${row.invoiceNumber}`,
        reference,
        invoicePaymentId: payment.id,
        importedTransactionId: input.importedTransactionId ?? null,
      },
    });
    await this.audit.record(tx, {
      action: 'PAYMENT_RECORDED',
      entityType: 'InvoicePayment',
      entityId: payment.id,
      summary: `₦${money(amount)} received for ${row.invoiceNumber}`,
    });
    return { payment, transaction: txn, invoiceNumber: row.invoiceNumber };
  }

  async recordForInvoice(
    invoiceId: string,
    dto: RecordPaymentDto,
  ): Promise<InvoiceView> {
    await this.prisma.$transaction((tx) =>
      this.recordInTx(tx, { invoiceId, ...dto }),
    );
    return this.invoiceView(invoiceId);
  }

  async listForInvoice(invoiceId: string) {
    const inv = await this.invoiceView(invoiceId);
    return { invoiceId, payments: inv.payments };
  }

  /** "Customer paid me": spreads one payment across the customer's open invoices, oldest due date first. */
  async recordForCustomer(customerId: string, dto: RecordPaymentDto) {
    const result = await this.prisma.$transaction(async (tx) => {
      const customer = await tx.customer.findFirst({
        where: { id: customerId, businessId: BUSINESS_ID },
      });
      if (!customer)
        throw new NotFoundException('We could not find that customer.');
      const today = todayInLagos();
      const invoices = await tx.invoice.findMany({
        where: {
          businessId: BUSINESS_ID,
          customerId,
          isDraft: false,
          voidedAt: null,
        },
        include: invoiceInclude,
        orderBy: [{ dueDate: 'asc' }, { invoiceNumber: 'asc' }],
      });
      const open = invoices
        .map((r) => ({ r, bal: computeInvoice(r, today).balance }))
        .filter((x) => x.bal.gt(0));
      const owing = open.reduce((s, x) => s.plus(x.bal), new Decimal(0));
      let left = D(dto.amount);
      if (left.lte(0))
        throw new BadRequestException(
          'The payment amount must be more than zero.',
        );
      if (open.length === 0)
        throw new ConflictException(
          `${customer.name} does not owe anything right now.`,
        );
      if (left.gt(owing))
        throw new BadRequestException(
          `${customer.name} only owes ₦${money(owing)}.`,
        );

      const applied: { invoiceNumber: string; amount: string }[] = [];
      for (const { r, bal } of open) {
        if (left.lte(0)) break;
        const part = Decimal.min(left, bal);
        const res = await this.recordInTx(tx, {
          invoiceId: r.id,
          amount: part.toFixed(2),
          paymentDate: dto.paymentDate,
          method: dto.method,
          reference: dto.reference,
        });
        applied.push({ invoiceNumber: res.invoiceNumber, amount: money(part) });
        left = left.minus(part);
      }
      return {
        customer: { id: customer.id, name: customer.name },
        totalApplied: money(D(dto.amount)),
        applied,
      };
    });
    return result;
  }

  private async invoiceView(id: string): Promise<InvoiceView> {
    const row = await this.prisma.invoice.findFirst({
      where: { id, businessId: BUSINESS_ID },
      include: invoiceInclude,
    });
    if (!row) throw new NotFoundException('We could not find that invoice.');
    return toInvoiceView(row, todayInLagos());
  }
}
