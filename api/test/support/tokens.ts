import { SignJWT } from 'jose';

/** The shared HS256 secret the integration suite (and global-setup) configure the API to trust. */
export const TEST_JWT_SECRET = 'settleng-integration-test-secret';

const key = new TextEncoder().encode(TEST_JWT_SECRET);

/**
 * Signs a Supabase-shaped access token for a test user. `sub` is the user id and `full_name` mirrors
 * the sign-up metadata the app stores. Each helper call can mint a token for a distinct user so the
 * suite can prove one tenant never sees another's data.
 */
export async function signTestToken(opts: {
  sub: string;
  fullName?: string;
  email?: string;
}): Promise<string> {
  return new SignJWT({
    aud: 'authenticated',
    email: opts.email ?? `${opts.sub}@example.com`,
    user_metadata: { full_name: opts.fullName ?? 'Test Owner' },
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(opts.sub)
    .setIssuer('test')
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(key);
}
