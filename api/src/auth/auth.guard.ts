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

/** Header the web app sends to pick which workspace the request acts on. */
export const WORKSPACE_HEADER = 'x-workspace-id';

/**
 * Global guard: every route requires a valid Supabase access token unless marked @Public().
 *
 * Access is granted by membership, not ownership. The active workspace is the one named in the
 * `x-workspace-id` header *if the signed-in user is an active member of it*; otherwise it falls
 * back to the workspace they own (or any they belong to). The workspace id always comes from a
 * membership row, never from a body or query parameter, so a request cannot reach another tenant.
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

    const store = tenantStore();
    if (!store) return true;
    store.userId = user.id;
    store.email = user.email;
    store.fullName = user.fullName;
    if (store.workspaceId) return true;

    const requested = String(req.headers[WORKSPACE_HEADER] ?? '').trim();
    let membership = requested
      ? await this.prisma.organisationMembership.findFirst({
          where: {
            workspaceId: requested,
            userId: user.id,
            status: 'ACTIVE',
          },
          select: { workspaceId: true, role: true },
        })
      : null;

    if (!membership) {
      membership = await this.prisma.organisationMembership.findFirst({
        where: { userId: user.id, status: 'ACTIVE' },
        // Enum order is OWNER, MANAGER, STAFF, so this prefers the workspace they own.
        orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
        select: { workspaceId: true, role: true },
      });
    }

    if (membership) {
      store.workspaceId = membership.workspaceId;
      store.role = membership.role as 'OWNER' | 'MANAGER' | 'STAFF';
      return true;
    }

    // No membership yet: claim any invitation addressed to this verified email.
    if (user.email) {
      await this.prisma.organisationMembership.updateMany({
        where: { invitedEmail: user.email, status: 'INVITED', userId: null },
        data: { userId: user.id, status: 'ACTIVE' },
      });
      const claimed = await this.prisma.organisationMembership.findFirst({
        where: { userId: user.id, status: 'ACTIVE' },
        orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
        select: { workspaceId: true, role: true },
      });
      if (claimed) {
        store.workspaceId = claimed.workspaceId;
        store.role = claimed.role as 'OWNER' | 'MANAGER' | 'STAFF';
      }
    }
    return true;
  }
}
