import { currentBusinessId } from '../auth/tenant-context';

/**
 * The authenticated user's business id, resolved from the verified Supabase token on every request.
 * It is never taken from the client, so a request can only ever touch its own business's data.
 * Throws if the user has not finished onboarding.
 */
export function requireBusinessId(): string {
  return currentBusinessId();
}
