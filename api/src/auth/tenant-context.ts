import { AsyncLocalStorage } from 'async_hooks';
import { UnauthorizedException } from '@nestjs/common';

/**
 * The authenticated tenant for the current request. It is derived from the verified Supabase
 * access token (never from anything the client sends in a body or query), so every service query
 * and mutation scopes to the right business automatically.
 */
export interface TenantContext {
  /** The Supabase auth user id (JWT `sub`). */
  userId: string;
  /** The user's full name from their profile / sign-up metadata. */
  fullName: string | null;
  /** The business owned by this user. Undefined until onboarding (bootstrap) completes. */
  businessId?: string;
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
 * The authenticated user's business id. Throws if the user has not finished onboarding, so a
 * request can never silently operate on the wrong (or no) business.
 */
export function currentBusinessId(): string {
  const ctx = storage.getStore();
  if (!ctx?.userId)
    throw new UnauthorizedException('Please sign in to continue.');
  if (!ctx.businessId)
    throw new UnauthorizedException(
      'Please finish setting up your business first.',
    );
  return ctx.businessId;
}

/** The user's display name, or null when unknown. */
export function currentUserName(): string | null {
  return storage.getStore()?.fullName ?? null;
}
