import { Global, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthController } from './onboarding.controller';
import { AuthGuard } from './auth.guard';
import { SupabaseAdminService } from './supabase-admin';
import { SupabaseJwtService } from './supabase-jwt';
import { TenantMiddleware } from './tenant.middleware';

@Global()
@Module({
  controllers: [AuthController],
  // SupabaseJwtService needs PrismaService, which is exported by the global PrismaModule.
  providers: [
    SupabaseJwtService,
    SupabaseAdminService,
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
  exports: [SupabaseJwtService, SupabaseAdminService],
})
export class AuthModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Establish the per-request tenant context before the guard and controllers run.
    consumer.apply(TenantMiddleware).forRoutes('*');
  }
}
