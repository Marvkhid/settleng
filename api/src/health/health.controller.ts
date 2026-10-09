import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { DEMO_BUSINESS_ID } from '../seed/seed-data';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /** Liveness: the process is running. Use this for the host's health check. */
  @Get()
  @ApiOkResponse({ description: 'API is running' })
  check() {
    return {
      status: 'ok',
      service: 'settleng-api',
      time: new Date().toISOString(),
    };
  }

  /** Readiness: the database answers, and tells you whether the sample business has been loaded. */
  @Get('ready')
  @ApiOkResponse({ description: 'API can reach its database' })
  async ready() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      const business = await this.prisma.business.findUnique({
        where: { id: DEMO_BUSINESS_ID },
        select: { id: true },
      });
      return {
        status: 'ok',
        database: 'up',
        sampleData: business ? 'loaded' : 'missing',
      };
    } catch {
      throw new ServiceUnavailableException(
        'The database is not reachable. Check DATABASE_URL and that migrations have run.',
      );
    }
  }
}
