import { Injectable, NestMiddleware } from '@nestjs/common';
import type { Request, Response } from 'express';
import { runWithTenant } from './tenant-context';

/**
 * Wraps every request in a fresh tenant context (AsyncLocalStorage). The AuthGuard then fills it
 * with the verified user and their business, and services read it — so there is no way for one
 * tenant's data to leak into another's request.
 */
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  use(_req: Request, _res: Response, next: () => void): void {
    runWithTenant({}, next);
  }
}
