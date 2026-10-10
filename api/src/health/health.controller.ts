import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/public.decorator';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /** Liveness: the process is running. Use this for the host's health check. */
  @Public()
  @Get()
  @ApiOkResponse({ description: 'API is running' })
  check() {
    return {
      status: 'ok',
      service: 'settleng-api',
      time: new Date().toISOString(),
    };
  }

  /** Readiness: the database answers. */
  @Public()
  @Get('ready')
  @ApiOkResponse({ description: 'API can reach its database' })
  async ready() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', database: 'up' };
    } catch {
      throw new ServiceUnavailableException(
        'The database is not reachable. Check DATABASE_URL and that migrations have run.',
      );
    }
  }
}
