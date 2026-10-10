import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { requireBusinessId } from '../common/business';
import { PrismaService } from '../prisma/prisma.service';

class AuditQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) limit: number =
    50;
}

@ApiTags('audit')
@Controller('audit')
export class AuditController {
  constructor(private readonly prisma: PrismaService) {}
  @Get()
  async list(@Query() q: AuditQuery) {
    const rows = await this.prisma.auditEvent.findMany({
      where: { businessId: requireBusinessId() },
      orderBy: { createdAt: 'desc' },
      take: q.limit,
    });
    return {
      items: rows.map((r) => ({
        id: r.id,
        action: r.action,
        entityType: r.entityType,
        entityId: r.entityId,
        summary: r.summary,
        createdAt: r.createdAt.toISOString(),
      })),
    };
  }
}
