import { Controller, Get, Param } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/public.decorator';
import { RecoveryService } from './recovery.service';

/**
 * Public, unauthenticated access to a single payment request. Rate limited hard, read-only, and
 * deliberately silent about why a token failed.
 */
@ApiTags('public')
@Controller('public/payment-requests')
export class PublicRecoveryController {
  constructor(private readonly recovery: RecoveryService) {}

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Get(':token')
  get(@Param('token') token: string) {
    return this.recovery.publicPaymentRequest(token);
  }
}
