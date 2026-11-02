import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

const BUCKET = 'debt-documents';
const ALLOWED = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/pdf',
]);
export const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;

/**
 * Evidence documents live in a PRIVATE Supabase Storage bucket. The API holds the service-role key
 * and hands the browser short-lived signed links, so a leaked URL stops working and no debtor's
 * documents are ever publicly listable.
 */
@Injectable()
export class DocumentsService {
  private readonly log = new Logger(DocumentsService.name);
  private bucketReady = false;

  constructor(private readonly prisma: PrismaService) {}

  private config(): { url: string; key: string } {
    const url = (
      process.env.SUPABASE_URL ??
      process.env.NEXT_PUBLIC_SUPABASE_URL ??
      ''
    ).replace(/\/+$/, '');
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
    if (!url || !key)
      throw new ServiceUnavailableException(
        'Document storage is not configured on this deployment (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set).',
      );
    return { url, key };
  }

  private headers(key: string): Record<string, string> {
    return { apikey: key, Authorization: `Bearer ${key}` };
  }

  private async ensureBucket() {
    if (this.bucketReady) return;
    const { url, key } = this.config();
    const res = await fetch(`${url}/storage/v1/bucket`, {
      method: 'POST',
      headers: { ...this.headers(key), 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: BUCKET, name: BUCKET, public: false }),
    });
    // 400/409 means it already exists, which is fine.
    if (!res.ok && res.status !== 400 && res.status !== 409) {
      this.log.error(`Could not create bucket ${BUCKET}: ${res.status}`);
      throw new ServiceUnavailableException(
        'Document storage is not available right now. Please try again later.',
      );
    }
    this.bucketReady = true;
  }

  async upload(input: {
    workspaceId: string;
    debtId: string;
    userId: string;
    filename: string;
    mime: string;
    buffer: Buffer;
  }) {
    if (!ALLOWED.has(input.mime))
      throw new BadRequestException('Upload a PDF, PNG, JPEG or WebP file.');
    if (input.buffer.length === 0) throw new BadRequestException('That file is empty.');
    if (input.buffer.length > MAX_DOCUMENT_BYTES)
      throw new BadRequestException('Files must be 5 MB or smaller.');

    await this.ensureBucket();
    const { url, key } = this.config();
    const safeName = input.filename.replace(/[^\w.\-]+/g, '_').slice(-80);
    const storageKey = `${input.workspaceId}/${input.debtId}/${randomUUID()}-${safeName}`;

    const res = await fetch(`${url}/storage/v1/object/${BUCKET}/${storageKey}`, {
      method: 'POST',
      headers: {
        ...this.headers(key),
        'Content-Type': input.mime,
        'x-upsert': 'false',
      },
      body: new Uint8Array(input.buffer),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      this.log.error(`Storage upload failed ${res.status}: ${body}`);
      throw new ServiceUnavailableException(
        'We could not store that file. Please try again.',
      );
    }

    const doc = await this.prisma.supportingDocument.create({
      data: {
        workspaceId: input.workspaceId,
        debtId: input.debtId,
        storageKey,
        filename: input.filename.slice(0, 160),
        mime: input.mime,
        sizeBytes: input.buffer.length,
        uploadedByUserId: input.userId,
      },
    });
    return {
      id: doc.id,
      filename: doc.filename,
      mime: doc.mime,
      sizeBytes: doc.sizeBytes,
      createdAt: doc.createdAt.toISOString(),
    };
  }

  async signedUrl(workspaceId: string, documentId: string) {
    const doc = await this.prisma.supportingDocument.findFirst({
      where: { id: documentId, workspaceId },
    });
    if (!doc) throw new NotFoundException('We could not find that document.');
    const { url, key } = this.config();
    const res = await fetch(
      `${url}/storage/v1/object/sign/${BUCKET}/${doc.storageKey}`,
      {
        method: 'POST',
        headers: { ...this.headers(key), 'Content-Type': 'application/json' },
        body: JSON.stringify({ expiresIn: 300 }),
      },
    );
    if (!res.ok)
      throw new ServiceUnavailableException(
        'We could not open that document. Please try again.',
      );
    const body = (await res.json()) as { signedURL?: string };
    if (!body.signedURL)
      throw new ServiceUnavailableException(
        'We could not open that document. Please try again.',
      );
    return { url: `${url}/storage/v1${body.signedURL}`, expiresIn: 300, filename: doc.filename };
  }
}
