import { Injectable, UnauthorizedException } from '@nestjs/common';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';

/** Verified Supabase access-token claims we rely on. */
export interface VerifiedUser {
  /** Supabase user id (`sub`). */
  id: string;
  email: string | null;
  /** `user_metadata.full_name` captured at sign-up. */
  fullName: string | null;
}

/**
 * Verifies Supabase access tokens (JWTs) by checking their signature against Supabase's published
 * JWKS. The `iss` claim must match our Supabase project URL so a token minted for another project
 * is rejected. Keys are cached so each request does not re-download them.
 */
@Injectable()
export class SupabaseJwtService {
  private jwks?: ReturnType<typeof createRemoteJWKSet>;
  private issuer = '';
  private audience = 'authenticated';

  constructor() {
    const url =
      process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
    const jwtSecret = process.env.SUPABASE_JWT_SECRET;
    if (!url && !jwtSecret)
      throw new Error(
        'Set SUPABASE_URL (preferred, uses JWKS) or SUPABASE_JWT_SECRET so the API can verify sign-in tokens.',
      );
    if (url) {
      this.issuer = `${url.replace(/\/+$/, '')}/auth/v1`;
      this.jwks = createRemoteJWKSet(
        new URL(`${this.issuer}/.well-known/jwks.json`),
      );
    }
  }

  /** Verifies a raw access token and returns the user it belongs to. Throws when invalid. */
  async verify(token: string): Promise<VerifiedUser> {
    if (!token) throw new UnauthorizedException('Please sign in to continue.');
    try {
      const secret = process.env.SUPABASE_JWT_SECRET;
      let payload: JWTPayload;
      if (this.jwks) {
        ({ payload } = await jwtVerify(token, this.jwks, {
          issuer: this.issuer,
          audience: this.audience,
        }));
      } else if (secret) {
        ({ payload } = await jwtVerify(
          token,
          new TextEncoder().encode(secret),
          { audience: this.audience },
        ));
      } else {
        throw new UnauthorizedException('Please sign in to continue.');
      }
      const sub = payload.sub;
      if (!sub) throw new UnauthorizedException('Please sign in to continue.');
      const metadata = payload.user_metadata as
        { full_name?: string } | undefined;
      return {
        id: sub,
        email: typeof payload.email === 'string' ? payload.email : null,
        fullName: metadata?.full_name ?? null,
      };
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException(
        'Your session is invalid or has expired.',
      );
    }
  }
}
