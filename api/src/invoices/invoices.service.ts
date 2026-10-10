import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import Decimal from 'decimal.js';
import { AuditService } from '../common/audit.service';
import { requireBusinessId } from '../common/business';
import {
  addDaysIso,
  isRealDate,
  todayInLagos,
  toDbDate,
} from '../common/dates';
import { D, money } from '../common/money';
import { Page, pageOf } from '../common/pagination';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateInvoiceDto,
  InvoiceItemDto,
  InvoiceListQuery,
  UpdateInvoiceDto,
} from './invoice.dto';
import {
  computeInvoice,
  invoiceInclude,
  InvoiceView,
  toInvoiceView,
} from './invoice-view';

type Db = Prisma.TransactionClient;

@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private checkDates(issue: string, due: string) {
    if (!isRealDate(issue) || !isRealDate(due))
      throw new BadRequestException('Please enter real dates.');
    if (due < issue)
      throw new BadRequestException(
        'The due date cannot be before the issue date.',
      );
  }

  private checkItems(items: InvoiceItemDto[]) {
    for (const i of items) {
      if (D(i.quantity).lte(0))
        throw new BadRequestException('Each item needs a quantity above zero.');
      if (D(i.unitPrice).lt(0))
        throw new BadRequestException('Prices cannot be negative.');
    }
  }

  private async nextNumber(db: Db): Promise<string> {
    const all = await db.invoice.findMany({
      where: { businessId: requireBusinessId() },
      select: { invoiceNumber: true },
    });
    const max = all.reduce((m, i) => {
      const n = /(\d+)$/.exec(i.invoiceNumber);
      return n ? Math.max(m, Number(n[1])) : m;
    }, 0);
    return `AMM-${String(max + 1).padStart(4, '0')}`;
  }

  private async customerOrThrow(db: Db, id: string) {
    const c = await db.customer.findFirst({
      where: { id, businessId: requireBusinessId() },
    });
    if (!c) throw new NotFoundException('We could not find that customer.');
    if (c.archivedAt)
      throw new BadRequestException(
        'This customer is archived. Restore them before creating invoices.',
      );
    return c;
  }

  async list(q: InvoiceListQuery): Promise<Page<InvoiceView>> {
    const today = todayInLagos();
    const where: Prisma.InvoiceWhereInput = { businessId: requireBusinessId() };
    if (q.customerId) where.customerId = q.customerId;
    if (q.search)
      where.OR = [
        { invoiceNumber: { contains: q.search, mode: 'insensitive' } },
        { customer: { name: { contains: q.search, mode: 'insensitive' } } },
      ];
    // Status is derived (never stored), so filter after computing. Fine at demo scale.
    const rows = await this.prisma.invoice.findMany({
      where,
      include: invoiceInclude,
      orderBy: [{ issueDate: 'desc' }, { invoiceNumber: 'desc' }],
    });
    const views = rows
      .map((r) => toInvoiceView(r, today))
      .filter((v) => !q.status || v.status === q.status);
    const start = (q.page - 1) * q.pageSize;
    return pageOf(views.slice(start, start + q.pageSize), views.length, q);
  }

  async get(id: string): Promise<InvoiceView> {
    const row = await this.prisma.invoice.findFirst({
      where: { id, businessId: requireBusinessId() },
      include: invoiceInclude,
    });
    if (!row) throw new NotFoundException('We could not find that invoice.');
    return toInvoiceView(row, todayInLagos());
  }

  async create(dto: CreateInvoiceDto): Promise<InvoiceView> {
    this.checkDates(dto.issueDate, dto.dueDate);
    this.checkItems(dto.items);
    const id = await this.prisma.$transaction(async (tx) => {
      await this.customerOrThrow(tx, dto.customerId);
      const number = dto.invoiceNumber?.trim() || (await this.nextNumber(tx));
      const inv = await this.createRow(tx, {
        ...dto,
        invoiceNumber: number,
        isDraft: !!dto.saveAsDraft,
      });
      await this.audit.record(tx, {
        action: 'INVOICE_CREATED',
        entityType: 'Invoice',
        entityId: inv.id,
        summary: `Invoice ${number} created${dto.saveAsDraft ? ' (draft)' : ''}`,
      });
      return inv.id;
    });
    return this.get(id);
  }

  /** Used by quick credit sales: a one-line invoice due in 14 days. */
  async createQuickCreditInvoice(
    tx: Db,
    a: {
      customerId: string;
      amount: string;
      description: string;
      date: string;
    },
  ) {
    await this.customerOrThrow(tx, a.customerId);
    const number = await this.nextNumber(tx);
    const inv = await this.createRow(tx, {
      customerId: a.customerId,
      invoiceNumber: number,
      issueDate: a.date,
      dueDate: addDaysIso(a.date, 14),
      isDraft: false,
      items: [
        { description: a.description, quantity: '1', unitPrice: a.amount },
      ],
    });
    await this.audit.record(tx, {
      action: 'INVOICE_CREATED',
      entityType: 'Invoice',
      entityId: inv.id,
      summary: `Credit sale recorded as invoice ${number}`,
    });
    return inv;
  }

  private createRow(
    tx: Db,
    a: {
      customerId: string;
      invoiceNumber: string;
      issueDate: string;
      dueDate: string;
      isDraft: boolean;
      items: InvoiceItemDto[];
    },
  ) {
    return tx.invoice.create({
      data: {
        businessId: requireBusinessId(),
        customerId: a.customerId,
        invoiceNumber: a.invoiceNumber,
        issueDate: toDbDate(a.issueDate),
        dueDate: toDbDate(a.dueDate),
        isDraft: a.isDraft,
        items: {
          create: a.items.map((i) => ({
            description: i.description.trim(),
            quantity: i.quantity,
            unitPrice: i.unitPrice,
          })),
        },
      },
    });
  }

  private async lockedRow(tx: Db, id: string) {
    await tx.$queryRaw`SELECT "id" FROM "Invoice" WHERE "id" = ${id} AND "businessId" = ${requireBusinessId()} FOR UPDATE`;
    const row = await tx.invoice.findFirst({
      where: { id, businessId: requireBusinessId() },
      include: invoiceInclude,
    });
    if (!row) throw new NotFoundException('We could not find that invoice.');
    return row;
  }

  async update(id: string, dto: UpdateInvoiceDto): Promise<InvoiceView> {
    await this.prisma.$transaction(async (tx) => {
      const row = await this.lockedRow(tx, id);
      if (row.voidedAt)
        throw new BadRequestException('A void invoice cannot be edited.');
      const hasPayments = row.payments.length > 0;
      if (hasPayments && dto.customerId && dto.customerId !== row.customerId)
        throw new BadRequestException(
          'You cannot change the customer on an invoice that already has payments.',
        );
      if (dto.customerId && dto.customerId !== row.customerId)
        await this.customerOrThrow(tx, dto.customerId);

      const issue = dto.issueDate ?? row.issueDate.toISOString().slice(0, 10);
      const due = dto.dueDate ?? row.dueDate.toISOString().slice(0, 10);
      this.checkDates(issue, due);
      if (dto.items) {
        this.checkItems(dto.items);
        const newTotal = dto.items.reduce(
          (s, i) => s.plus(D(i.quantity).times(i.unitPrice)),
          new Decimal(0),
        );
        const paid = computeInvoice(row, todayInLagos()).paid;
        if (newTotal.lt(paid))
          throw new BadRequestException(
            `The new total (₦${money(newTotal)}) is less than the ₦${money(paid)} already paid.`,
          );
        await tx.invoiceItem.deleteMany({ where: { invoiceId: id } });
        await tx.invoiceItem.createMany({
          data: dto.items.map((i) => ({
            invoiceId: id,
            description: i.description.trim(),
            quantity: i.quantity,
            unitPrice: i.unitPrice,
          })),
        });
      }
      await tx.invoice.update({
        where: { id },
        data: {
          customerId: dto.customerId,
          invoiceNumber: dto.invoiceNumber?.trim() || undefined,
          issueDate: dto.issueDate ? toDbDate(dto.issueDate) : undefined,
          dueDate: dto.dueDate ? toDbDate(dto.dueDate) : undefined,
        },
      });
      await this.audit.record(tx, {
        action: 'INVOICE_EDITED',
        entityType: 'Invoice',
        entityId: id,
        summary: `Invoice ${dto.invoiceNumber ?? row.invoiceNumber} edited`,
      });
    });
    return this.get(id);
  }

  async issue(id: string): Promise<InvoiceView> {
    await this.prisma.$transaction(async (tx) => {
      const row = await this.lockedRow(tx, id);
      if (row.voidedAt)
        throw new BadRequestException('A void invoice cannot be issued.');
      if (!row.isDraft)
        throw new ConflictException('This invoice has already been issued.');
      await tx.invoice.update({ where: { id }, data: { isDraft: false } });
      await this.audit.record(tx, {
        action: 'INVOICE_ISSUED',
        entityType: 'Invoice',
        entityId: id,
        summary: `Invoice ${row.invoiceNumber} issued`,
      });
    });
    return this.get(id);
  }

  async void(id: string): Promise<InvoiceView> {
    await this.prisma.$transaction(async (tx) => {
      const row = await this.lockedRow(tx, id);
      if (row.voidedAt)
        throw new ConflictException('This invoice is already void.');
      if (row.payments.length > 0)
        throw new BadRequestException(
          'This invoice has payments, so it cannot be voided. Payment history is never deleted.',
        );
      await tx.invoice.update({
        where: { id },
        data: { voidedAt: new Date() },
      });
      await this.audit.record(tx, {
        action: 'INVOICE_VOIDED',
        entityType: 'Invoice',
        entityId: id,
        summary: `Invoice ${row.invoiceNumber} voided`,
      });
    });
    return this.get(id);
  }

  /** Draft invoices with no payments can be removed entirely; anything else must be voided. */
  async deleteDraft(id: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const row = await this.lockedRow(tx, id);
      if (!row.isDraft || row.payments.length > 0)
        throw new BadRequestException(
          'Only draft invoices can be deleted. Void the invoice instead.',
        );
      await tx.invoice.delete({ where: { id } });
      await this.audit.record(tx, {
        action: 'INVOICE_DELETED',
        entityType: 'Invoice',
        entityId: id,
        summary: `Draft invoice ${row.invoiceNumber} deleted`,
      });
    });
  }
}
