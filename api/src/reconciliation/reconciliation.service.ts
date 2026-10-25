import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditService } from '../common/audit.service';
import { requireBusinessId } from '../common/business';
import { isoDate, todayInLagos, toDbDate } from '../common/dates';
import { D, money } from '../common/money';
import { computeInvoice, invoiceInclude } from '../invoices/invoice-view';
import { PaymentsService } from '../payments/payments.service';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { suggestMatches } from './matcher';
import {
  ColumnMapping,
  duplicateKey,
  markDuplicates,
  MAX_FILE_BYTES,
  parseStatement,
  ParsedRow,
  SAMPLE_CSV,
} from './statement-parser';

type AnalysedRow = ParsedRow & {
  matchStatus:
    'VALID' | 'INVALID' | 'DUPLICATE' | 'UNMATCHED' | 'SUGGESTED_MATCH';
  suggestedInvoiceId: string | null;
};

@Injectable()
export class ReconciliationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentsService,
    private readonly audit: AuditService,
  ) {}

  template() {
    return { filename: 'settleng-sample-statement.csv', body: SAMPLE_CSV };
  }

  private readFile(file: Express.Multer.File | undefined): string {
    if (!file)
      throw new BadRequestException('Please choose a CSV file to upload.');
    if (file.size > MAX_FILE_BYTES)
      throw new BadRequestException(
        'That file is too large. Keep it under 1 MB.',
      );
    if (!/\.csv$/i.test(file.originalname))
      throw new BadRequestException('Please upload a .csv file.');
    return file.buffer.toString('utf8');
  }

  private parseMapping(raw?: string): Partial<ColumnMapping> | undefined {
    if (!raw) return undefined;
    try {
      const v: unknown = JSON.parse(raw);
      if (v && typeof v === 'object') return v;
    } catch {
      /* fall through */
    }
    throw new BadRequestException(
      'The column choices could not be read. Please pick the columns again.',
    );
  }

  private async openInvoices(
    db: Prisma.TransactionClient | PrismaService,
    today: string,
  ) {
    const rows = await db.invoice.findMany({
      where: {
        businessId: requireBusinessId(),
        isDraft: false,
        voidedAt: null,
      },
      include: invoiceInclude,
    });
    return rows
      .map((r) => ({
        id: r.id,
        invoiceNumber: r.invoiceNumber,
        customerName: r.customer.name,
        balance: computeInvoice(r, today).balance,
        issueDate: isoDate(r.issueDate),
      }))
      .filter((i) => i.balance.gt(0));
  }

  private async analyse(text: string, mapping?: Partial<ColumnMapping>) {
    const today = todayInLagos();
    const parsed = parseStatement(text, today, mapping);
    if (parsed.problems.length) return { parsed, rows: [] as AnalysedRow[] };
    const existing = await this.prisma.importedTransaction.findMany({
      where: {
        import: { businessId: requireBusinessId() },
        matchStatus: { notIn: ['INVALID', 'DUPLICATE'] },
      },
      select: {
        externalReference: true,
        date: true,
        amount: true,
        direction: true,
        description: true,
      },
    });
    const existingKeys = new Set(
      existing.map((e) =>
        duplicateKey({
          externalReference: e.externalReference,
          date: e.date ? isoDate(e.date) : null,
          amount: e.amount ? D(e.amount).toFixed(2) : null,
          direction: e.direction,
          description: e.description,
        }),
      ),
    );
    const rows = markDuplicates(parsed.rows, existingKeys);
    const suggestions = suggestMatches(
      rows
        .filter((r) => r.status === 'VALID' && r.direction === 'IN')
        .map((r) => ({
          rowNumber: r.rowNumber,
          description: r.description,
          amount: r.amount!,
        })),
      await this.openInvoices(this.prisma, today),
    );
    const analysed: AnalysedRow[] = rows.map((r) => {
      if (r.status === 'INVALID' || r.status === 'DUPLICATE')
        return { ...r, matchStatus: r.status, suggestedInvoiceId: null };
      if (r.direction === 'OUT')
        return { ...r, matchStatus: 'VALID', suggestedInvoiceId: null };
      const s = suggestions.get(r.rowNumber) ?? null;
      return {
        ...r,
        matchStatus: s ? 'SUGGESTED_MATCH' : 'UNMATCHED',
        suggestedInvoiceId: s,
      };
    });
    return { parsed, rows: analysed };
  }

  private counts(rows: AnalysedRow[]) {
    const c: Record<string, number> = {
      VALID: 0,
      INVALID: 0,
      DUPLICATE: 0,
      UNMATCHED: 0,
      SUGGESTED_MATCH: 0,
      MATCHED: 0,
    };
    for (const r of rows) c[r.matchStatus]++;
    return c;
  }

  /** Nothing is saved. Shows what would happen so the user can fix columns first. */
  async preview(file: Express.Multer.File | undefined, mappingRaw?: string) {
    const { parsed, rows } = await this.analyse(
      this.readFile(file),
      this.parseMapping(mappingRaw),
    );
    return {
      filename: file!.originalname,
      headers: parsed.headers,
      mapping: parsed.mapping,
      problems: parsed.problems,
      rowCount: rows.length,
      counts: this.counts(rows),
      canSave: rows.some(
        (r) => r.matchStatus !== 'INVALID' && r.matchStatus !== 'DUPLICATE',
      ),
      rows: rows.map((r) => ({
        rowNumber: r.rowNumber,
        date: r.date,
        description: r.description,
        amount: r.amount,
        direction: r.direction,
        externalReference: r.externalReference,
        status: r.matchStatus,
        note: r.note,
      })),
    };
  }

  /** Re-checks the file on the server; the browser's preview is never trusted. */
  async save(file: Express.Multer.File | undefined, mappingRaw?: string) {
    const { parsed, rows } = await this.analyse(
      this.readFile(file),
      this.parseMapping(mappingRaw),
    );
    if (parsed.problems.length)
      throw new BadRequestException(parsed.problems.join(' '));
    if (
      !rows.some(
        (r) => r.matchStatus !== 'INVALID' && r.matchStatus !== 'DUPLICATE',
      )
    )
      throw new BadRequestException(
        'There are no usable rows in this file, so nothing was imported.',
      );
    const imp = await this.prisma.$transaction(async (tx) => {
      const created = await tx.reconciliationImport.create({
        data: {
          businessId: requireBusinessId(),
          filename: file!.originalname.slice(0, 200),
          rowCount: rows.length,
          status: rows.some((r) => r.matchStatus === 'SUGGESTED_MATCH')
            ? 'PENDING_REVIEW'
            : 'COMPLETED',
        },
      });
      await tx.importedTransaction.createMany({
        data: rows.map((r) => ({
          importId: created.id,
          externalReference: r.externalReference,
          date: r.date ? toDbDate(r.date) : null,
          description: r.description,
          amount: r.amount,
          direction: r.direction,
          matchStatus: r.matchStatus,
          suggestedInvoiceId: r.suggestedInvoiceId,
          rawRowNumber: r.rowNumber,
          note: r.note,
        })),
      });
      await this.audit.record(tx, {
        action: 'IMPORT_SAVED',
        entityType: 'ReconciliationImport',
        entityId: created.id,
        summary: `Imported ${rows.length} rows from ${created.filename}`,
      });
      return created;
    });
    return {
      id: imp.id,
      filename: imp.filename,
      rowCount: imp.rowCount,
      status: imp.status,
      counts: this.counts(rows),
    };
  }

  async listImports() {
    const imports = await this.prisma.reconciliationImport.findMany({
      where: { businessId: requireBusinessId() },
      orderBy: { createdAt: 'desc' },
      include: { rows: { select: { matchStatus: true } } },
    });
    return {
      items: imports.map((i) => {
        const counts: Record<string, number> = {};
        for (const r of i.rows)
          counts[r.matchStatus] = (counts[r.matchStatus] ?? 0) + 1;
        return {
          id: i.id,
          filename: i.filename,
          status: i.status,
          rowCount: i.rowCount,
          createdAt: i.createdAt.toISOString(),
          counts,
        };
      }),
    };
  }

  async getImport(id: string) {
    const imp = await this.prisma.reconciliationImport.findFirst({
      where: { id, businessId: requireBusinessId() },
      include: { rows: { orderBy: { rawRowNumber: 'asc' } } },
    });
    if (!imp) throw new NotFoundException('We could not find that import.');
    const ids = [
      ...new Set(
        imp.rows
          .flatMap((r) => [r.suggestedInvoiceId, r.matchedInvoiceId])
          .filter((x): x is string => !!x),
      ),
    ];
    const invs = await this.prisma.invoice.findMany({
      where: { id: { in: ids } },
      include: invoiceInclude,
    });
    const today = todayInLagos();
    const info = new Map(
      invs.map((i) => [
        i.id,
        {
          id: i.id,
          invoiceNumber: i.invoiceNumber,
          customer: i.customer.name,
          balance: money(computeInvoice(i, today).balance),
        },
      ]),
    );
    return {
      id: imp.id,
      filename: imp.filename,
      status: imp.status,
      rowCount: imp.rowCount,
      createdAt: imp.createdAt.toISOString(),
      notice:
        'These rows come from a file you uploaded. SettleNG has not verified them with any bank.',
      rows: imp.rows.map((r) => ({
        id: r.id,
        rowNumber: r.rawRowNumber,
        date: r.date ? isoDate(r.date) : null,
        description: r.description,
        amount: r.amount ? money(D(r.amount)) : null,
        direction: r.direction,
        externalReference: r.externalReference,
        status: r.matchStatus,
        note: r.note,
        suggestedInvoice: r.suggestedInvoiceId
          ? (info.get(r.suggestedInvoiceId) ?? null)
          : null,
        matchedInvoice: r.matchedInvoiceId
          ? (info.get(r.matchedInvoiceId) ?? null)
          : null,
      })),
    };
  }

  private async syncImportStatus(
    tx: Prisma.TransactionClient,
    importId: string,
  ) {
    const pending = await tx.importedTransaction.count({
      where: { importId, matchStatus: 'SUGGESTED_MATCH' },
    });
    await tx.reconciliationImport.update({
      where: { id: importId },
      data: { status: pending === 0 ? 'COMPLETED' : 'PENDING_REVIEW' },
    });
  }

  /** The user's explicit decision: records the payment and links it to the imported row. */
  async confirm(rowId: string, invoiceId?: string) {
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "ImportedTransaction" WHERE "id" = ${rowId} FOR UPDATE`;
      const row = await tx.importedTransaction.findFirst({
        where: { id: rowId, import: { businessId: requireBusinessId() } },
      });
      if (!row) throw new NotFoundException('We could not find that row.');
      if (row.matchStatus === 'MATCHED')
        throw new ConflictException('This row has already been matched.');
      if (
        row.matchStatus !== 'SUGGESTED_MATCH' &&
        row.matchStatus !== 'UNMATCHED'
      )
        throw new BadRequestException(
          'Only money-in rows that are waiting for a decision can be matched.',
        );
      if (row.direction !== 'IN' || !row.amount || !row.date)
        throw new BadRequestException(
          'Only valid money-in rows can be matched to an invoice.',
        );
      const target = invoiceId ?? row.suggestedInvoiceId;
      if (!target)
        throw new BadRequestException(
          'Choose the invoice this payment belongs to.',
        );
      const res = await this.payments.recordInTx(tx, {
        invoiceId: target,
        amount: D(row.amount).toFixed(2),
        paymentDate: isoDate(row.date),
        method: 'BANK_TRANSFER',
        reference: row.externalReference ?? `import-row-${row.id}`,
        importedTransactionId: row.id,
      });
      await tx.importedTransaction.update({
        where: { id: row.id },
        data: {
          matchStatus: 'MATCHED',
          matchedInvoiceId: target,
          suggestedInvoiceId: null,
          createdTransactionId: res.transaction.id,
        },
      });
      await this.audit.record(tx, {
        action: 'RECONCILIATION_CONFIRMED',
        entityType: 'ImportedTransaction',
        entityId: row.id,
        summary: `Row matched to ${res.invoiceNumber} by the user`,
      });
      await this.syncImportStatus(tx, row.importId);
    });
    return this.getRow(rowId);
  }

  async reject(rowId: string) {
    await this.prisma.$transaction(async (tx) => {
      const row = await tx.importedTransaction.findFirst({
        where: { id: rowId, import: { businessId: requireBusinessId() } },
      });
      if (!row) throw new NotFoundException('We could not find that row.');
      if (row.matchStatus !== 'SUGGESTED_MATCH')
        throw new BadRequestException(
          'Only suggested matches can be rejected.',
        );
      await tx.importedTransaction.update({
        where: { id: rowId },
        data: { matchStatus: 'UNMATCHED', suggestedInvoiceId: null },
      });
      await this.audit.record(tx, {
        action: 'RECONCILIATION_REJECTED',
        entityType: 'ImportedTransaction',
        entityId: rowId,
        summary: 'Suggested match rejected by the user',
      });
      await this.syncImportStatus(tx, row.importId);
    });
    return this.getRow(rowId);
  }

  private async getRow(rowId: string) {
    const row = await this.prisma.importedTransaction.findFirstOrThrow({
      where: { id: rowId, import: { businessId: requireBusinessId() } },
    });
    return {
      id: row.id,
      status: row.matchStatus,
      matchedInvoiceId: row.matchedInvoiceId,
      createdTransactionId: row.createdTransactionId,
    };
  }
}
