import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { HealthController } from './health/health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { CommonModule } from './common/common.module';
import { CustomersModule } from './customers/customers.module';
import { InvoicesModule } from './invoices/invoices.module';
import { PaymentsModule } from './payments/payments.module';
import { TransactionsModule } from './transactions/transactions.module';
import { ReportsModule } from './reports/reports.module';
import { ReconciliationModule } from './reconciliation/reconciliation.module';
import { AuditController } from './audit/audit.controller';

// Jest sets NODE_ENV=test. Tests must never inherit a developer's api/.env (it would point the
// suite at a real Supabase project and the wrong database), so the file is ignored there and
// process.env is the only source of configuration.
const isTest = process.env.NODE_ENV === 'test';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: isTest }),
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60_000, limit: 120 }],
      skipIf: () => process.env.THROTTLE_DISABLED === 'true',
    }),
    PrismaModule,
    AuthModule,
    CommonModule,
    CustomersModule,
    InvoicesModule,
    PaymentsModule,
    TransactionsModule,
    ReportsModule,
    ReconciliationModule,
  ],
  controllers: [HealthController, AuditController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
