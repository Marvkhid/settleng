import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import Decimal from 'decimal.js';
import { AuditService } from '../common/audit.service';
import { BUSINESS_ID } from '../common/business';
import { todayInLagos } from '../common/dates';
import { money } from '../common/money';
import { Page, pageOf } from '../common/pagination';
import { Prisma } from '../generated/prisma/client';
import {
  computeInvoice,
  invoiceInclude,
  toInvoiceView,
} from '../invoices/invoice-view';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateCustomerDto,
  CustomerListQuery,
  UpdateCustomerDto,
} from './customer.dto';

export interface CustomerSummary {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  archived: boolean;
  totalBought: string;
  totalPaid: string;
  amountOwing: string;
}

@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private async totalsFor(customerIds: string[]) {
    const today = todayInLagos();
    const rows = await this.prisma.invoice.findMany({
      where: {
        businessId: BUSINESS_ID,
        customerId: { in: customerIds },
        isDraft: false,
        voidedAt: null,
      },
      include: invoiceInclude,
    });
    const map = new Map<
      string,
      { bought: Decimal; paid: Decimal; owing: Decimal }
    >();
    for (const r of rows) {
      const c = computeInvoice(r, today);
      const t = map.get(r.customerId) ?? {
        bought: new Decimal(0),
        paid: new Decimal(0),
        owing: new Decimal(0),
      };
      t.bought = t.bought.plus(c.total);
      t.paid = t.paid.plus(c.paid);
      t.owing = t.owing.plus(c.balance);
      map.set(r.customerId, t);
    }
    return map;
  }

  private summary(
    c: Prisma.CustomerGetPayload<object>,
    t?: { bought: Decimal; paid: Decimal; owing: Decimal },
  ): CustomerSummary {
    return {
      id: c.id,
      name: c.name,
      email: c.email,
      phone: c.phone,
      notes: c.notes,
      archived: !!c.archivedAt,
      totalBought: money(t?.bought ?? 0),
      totalPaid: money(t?.paid ?? 0),
      amountOwing: money(t?.owing ?? 0),
    };
  }

  async list(q: CustomerListQuery): Promise<Page<CustomerSummary>> {
    const where: Prisma.CustomerWhereInput = { businessId: BUSINESS_ID };
    if (!q.includeArchived) where.archivedAt = null;
    if (q.search)
      where.OR = [
        { name: { contains: q.search, mode: 'insensitive' } },
        { phone: { contains: q.search } },
        { email: { contains: q.search, mode: 'insensitive' } },
      ];
    const customers = await this.prisma.customer.findMany({
      where,
      orderBy: { name: 'asc' },
    });
    const totals = await this.totalsFor(customers.map((c) => c.id));
    let all = customers.map((c) => this.summary(c, totals.get(c.id)));
    if (q.owingOnly) all = all.filter((c) => new Decimal(c.amountOwing).gt(0));
    const start = (q.page - 1) * q.pageSize;
    return pageOf(all.slice(start, start + q.pageSize), all.length, q);
  }

  async get(id: string) {
    const c = await this.prisma.customer.findFirst({
      where: { id, businessId: BUSINESS_ID },
    });
    if (!c) throw new NotFoundException('We could not find that customer.');
    const today = todayInLagos();
    const [totals, invoices] = await Promise.all([
      this.totalsFor([id]),
      this.prisma.invoice.findMany({
        where: { businessId: BUSINESS_ID, customerId: id },
        include: invoiceInclude,
        orderBy: { issueDate: 'desc' },
      }),
    ]);
    const views = invoices.map((i) => toInvoiceView(i, today));
    const payments = views
      .flatMap((v) =>
        v.payments.map((p) => ({
          ...p,
          invoiceId: v.id,
          invoiceNumber: v.invoiceNumber,
        })),
      )
      .sort((a, b) => b.paymentDate.localeCompare(a.paymentDate));
    return {
      ...this.summary(c, totals.get(id)),
      invoices: views.map((v) => ({
        id: v.id,
        invoiceNumber: v.invoiceNumber,
        issueDate: v.issueDate,
        dueDate: v.dueDate,
        status: v.status,
        total: v.total,
        amountPaid: v.amountPaid,
        balance: v.balance,
      })),
      payments,
    };
  }

  async create(dto: CreateCustomerDto): Promise<CustomerSummary> {
    return this.prisma.$transaction(async (tx) => {
      const c = await tx.customer.create({
        data: {
          businessId: BUSINESS_ID,
          name: dto.name.trim(),
          email: dto.email,
          phone: dto.phone,
          notes: dto.notes,
        },
      });
      await this.audit.record(tx, {
        action: 'CUSTOMER_CREATED',
        entityType: 'Customer',
        entityId: c.id,
        summary: `Customer ${c.name} added`,
      });
      return this.summary(c);
    });
  }

  async update(id: string, dto: UpdateCustomerDto): Promise<CustomerSummary> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.customer.findFirst({
        where: { id, businessId: BUSINESS_ID },
      });
      if (!existing)
        throw new NotFoundException('We could not find that customer.');
      const c = await tx.customer.update({
        where: { id },
        data: {
          name: dto.name?.trim(),
          email: dto.email,
          phone: dto.phone,
          notes: dto.notes,
        },
      });
      await this.audit.record(tx, {
        action: 'CUSTOMER_UPDATED',
        entityType: 'Customer',
        entityId: id,
        summary: `Customer ${c.name} updated`,
      });
      return this.summary(c, (await this.totalsFor([id])).get(id));
    });
  }

  /** Customers are archived, never deleted, so invoice and payment history stays intact. */
  async setArchived(id: string, archived: boolean): Promise<CustomerSummary> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.customer.findFirst({
        where: { id, businessId: BUSINESS_ID },
      });
      if (!existing)
        throw new NotFoundException('We could not find that customer.');
      if (archived) {
        const t = (await this.totalsFor([id])).get(id);
        if (t && t.owing.gt(0))
          throw new ConflictException(
            `${existing.name} still owes ₦${money(t.owing)}. Settle it before archiving.`,
          );
      }
      const c = await tx.customer.update({
        where: { id },
        data: { archivedAt: archived ? new Date() : null },
      });
      await this.audit.record(tx, {
        action: archived ? 'CUSTOMER_ARCHIVED' : 'CUSTOMER_RESTORED',
        entityType: 'Customer',
        entityId: id,
        summary: `Customer ${c.name} ${archived ? 'archived' : 'restored'}`,
      });
      return this.summary(c, (await this.totalsFor([id])).get(id));
    });
  }
}
