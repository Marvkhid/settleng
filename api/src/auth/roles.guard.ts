import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { currentRole, type MemberRole } from './tenant-context';
import { ROLES_KEY } from './roles.decorator';

/**
 * Enforces `@Roles(...)` on a route. Roles come from the membership row the AuthGuard resolved,
 * so permissions are checked in exactly one place on the server and never rely on the UI hiding a
 * button. A route with no @Roles() is available to every active member.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<MemberRole[] | undefined>(
      ROLES_KEY,
      [ctx.getHandler(), ctx.getClass()],
    );
    if (!required || required.length === 0) return true;
    const role = currentRole();
    if (!role)
      throw new ForbiddenException(
        'You do not have access to this workspace.',
      );
    if (!required.includes(role))
      throw new ForbiddenException(
        role === 'STAFF'
          ? 'Only a workspace owner or manager can do that.'
          : 'Only a workspace owner can do that.',
      );
    return true;
  }
}
