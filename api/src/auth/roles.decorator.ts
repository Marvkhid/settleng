import { SetMetadata } from '@nestjs/common';
import type { MemberRole } from './tenant-context';

export const ROLES_KEY = 'roles';

/** Restricts a route to the given workspace roles. Enforced by RolesGuard on the server. */
export const Roles = (...roles: MemberRole[]) => SetMetadata(ROLES_KEY, roles);
