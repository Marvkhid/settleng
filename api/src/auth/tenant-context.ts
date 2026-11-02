import { AsyncLocalStorage } from 'async_hooks';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';

export type MemberRole = 'OWNER' | 'MANAGER' | 'STAFF';

/**
 * The authenticated tenant for the current request. It is derived from the verified Supabase
 * access token (never from anything the client sends in a body or query), so every service query
 * and mutation scopes to the right workspace automatically.
 */
export interface TenantContext {
  /** The Supabase auth user id (JWT `sub`). */
  userId: string;
  /** The user's email from the verified token, used only to claim a pending invitation. */
  email: string | null;
  /** The user's full name from their profile / sign-up metadata. */
  fullName: string | null;
  /** The active workspace, resolved from membership. Undefined before onboarding completes. */
  workspaceId?: string;
  /** The signed-in user's role in the active workspace. */
  role?: MemberRole;
}

const storage = new AsyncLocalStorage<TenantContext>();

/** Runs `fn` with an (initially empty) tenant store that the auth guard fills in. */
export function runWithTenant<T>(
  store: TenantContext | Record<string, never>,
  fn: () => T,
): T {
  return storage.run(store as TenantContext, fn);
}

/** The live store for this request. Populated by the middleware wrapper, read by the guard/services. */
export function tenantStore(): TenantContext | undefined {
  return storage.getStore();
}

/** The verified user id. Throws if the route was not authenticated. */
export function currentUserId(): string {
  const ctx = storage.getStore();
  if (!ctx?.userId)
    throw new UnauthorizedException('Please sign in to continue.');
  return ctx.userId;
}

/**
 * The active workspace id. Throws if the user has not finished onboarding, so a request can never
 * silently operate on the wrong (or no) workspace.
 *
 * The name is kept for the existing invoice/customer/transaction services; a workspace is the same
 * `Business` row they were already scoped to.
 */
export function currentBusinessId(): string {
  const ctx = storage.getStore();
  if (!ctx?.userId)
    throw new UnauthorizedException('Please sign in to continue.');
  if (!ctx.workspaceId)
    throw new UnauthorizedException(
      'Please finish setting up your workspace first.',
    );
  return ctx.workspaceId;
}

export const currentWorkspaceId = currentBusinessId;

/** The signed-in user's role in the active workspace, or null when they have none. */
export function currentRole(): MemberRole | null {
  return storage.getStore()?.role ?? null;
}

/** Throws unless the signed-in user holds one of the given roles in the active workspace. */
export function requireRole(...roles: MemberRole[]): void {
  const role = currentRole();
  if (!role) throw new UnauthorizedException('Please sign in to continue.');
  if (!roles.includes(role))
    throw new ForbiddenException(
      'Only a workspace owner or manager can do that.',
    );
}

/** The user's display name, or null when unknown. */
export function currentUserName(): string | null {
  return storage.getStore()?.fullName ?? null;
}

/** The signed-in user's email from the verified token, or null. */
export function currentUserEmail(): string | null {
  return storage.getStore()?.email ?? null;
}
