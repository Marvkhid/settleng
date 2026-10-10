import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { IS_PUBLIC_KEY } from './public.decorator';
import { SupabaseJwtService } from './supabase-jwt';
import { tenantStore } from './tenant-context';

type AuthedRequest = Request & { userId?: string; fullName?: string | null };

/**
 * Global guard: every route requires a valid Supabase access token unless marked @Public().
 * After verifying the token it attaches the user to the request and to the tenant context, and
 * resolves the user's business so all downstream queries are scoped to it. The business id is
 * always looked up from the owner id — never taken from the client.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: SupabaseJwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    if (isPublic) return true;

    const header = req.headers.authorization ?? '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token)
      throw new UnauthorizedException('Please sign in to continue.');

    const user = await this.jwt.verify(token);
    req.userId = user.id;
    req.fullName = user.fullName;

    // Resolve (or lazily cache) this user's business so every service scopes to it.
    const store = tenantStore();
    if (store) {
      store.userId = user.id;
      store.fullName = user.fullName;
      if (!store.businessId) {
        const business = await this.prisma.business.findUnique({
          where: { ownerId: user.id },
          select: { id: true },
        });
        if (business) store.businessId = business.id;
      }
    }
    return true;
  }
}
