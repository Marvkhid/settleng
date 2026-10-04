import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { BUSINESS_ID } from './business';

export interface AuditInput {
  action: string;
  entityType: string;
  entityId?: string;
  summary: string;
}

@Injectable()
export class AuditService {
  /** Pass the transaction client so the audit row commits or rolls back with the change itself. */
  record(db: Prisma.TransactionClient, e: AuditInput) {
    return db.auditEvent.create({
      data: {
        businessId: BUSINESS_ID,
        action: e.action,
        entityType: e.entityType,
        entityId: e.entityId ?? null,
        summary: e.summary,
      },
    });
  }
}
