import { ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { applySeed } from '../seed/apply-seed';
import { todayInLagos } from '../common/dates';
import { DEMO_BUSINESS_ID } from '../seed/seed-data';

@Injectable()
export class DemoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async workspace() {
    const business = await this.prisma.business.findUnique({
      where: { id: DEMO_BUSINESS_ID },
    });
    return {
      demoMode: this.config.get('DEMO_MODE', 'true') === 'true',
      notice: 'Demo mode · Sample business. All data is fictional.',
      business: business
        ? { id: business.id, name: business.name, currency: business.currency }
        : null,
    };
  }

  /** Restores the original sample data. Only allowed while DEMO_MODE=true; no arbitrary SQL involved. */
  async reset() {
    if (this.config.get('DEMO_MODE', 'true') !== 'true') {
      throw new ForbiddenException('Resetting is only available in demo mode.');
    }
    const counts = await this.prisma.$transaction(
      (tx) =>
        applySeed(tx, todayInLagos(), {
          audit: 'Demo reset to original sample data',
        }),
      { timeout: 60_000, maxWait: 20_000 },
    );
    return { status: 'reset', restored: counts };
  }
}
