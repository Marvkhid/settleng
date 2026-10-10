/** Controllable Supabase auth stub for web auth-page tests.

The real client module exports `supabase()` as a zero-arg factory that creates a browser client
from env. Auth pages call `supabase().auth.*`. To test without a real Supabase project, tests
import this factory and inject it via a tiny module override of `@/lib/supabase/client`.

Usage in a test:
  import { render, screen, waitFor } from "@testing-library/react";
  import userEvent from "@testing-library/user-event";
  import { supabase as realSupabase } from "@/lib/supabase/client";
  import { createMockSupabase, type MockSupabase } from "@/test/mock-supabase";

  let sup = createMockSupabase();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon-key");

  // The cleanest override: swap the module's supabase export for our stub. Because the pages
  // import `supabase` (the factory) and call `supabase().auth.*`, the test swaps the factory
  // function itself so each call returns the controllable instance.
  vi.doMock("@/lib/supabase/client", () => ({ supabase: () => sup }));
*/

export interface AuthSignInWithPasswordResult {
  data: { user: { id: string; email: string; app_metadata: Record<string, unknown> } } | null;
  error: { code: string; message: string } | null;
}

export interface AuthSignUpResult {
  data: { user: { id: string; email: string; app_metadata: Record<string, unknown> } } | null;
  session: { access_token: string; user: { id: string; email: string } } | null;
  error: { code: string; message: string } | null;
}

export interface AuthGetSessionResult {
  data: { session: { access_token: string; user: { id: string; email: string } | null } | null };
  error: { message: string } | null;
}

export interface MockSupabase {
  auth: {
    signInWithPassword: (opts: { email: string; password: string }) => Promise<AuthSignInWithPasswordResult>;
    signUp: (opts: { email: string; password: string; options?: { data?: Record<string, string> } }) => Promise<AuthSignUpResult>;
    resetPasswordForEmail: (email: string, opts: { redirectTo: string }) => Promise<{ error: { code: string; message: string } | null }>;
    updateUser: (opts: { password: string }) => Promise<{ error: { message: string } | null }>;
    getSession: () => Promise<AuthGetSessionResult>;
    signOut: () => Promise<{ error: { message: string } | null }>;
  };
}

export function createMockSupabase(opts?: { session?: { access_token: string; user: { id: string; email: string } | null } }): MockSupabase {
  const session: { access_token: string; user: { id: string; email: string } | null } = opts?.session ?? {
    access_token: "mock-access-token",
    user: { id: "u1", email: "a@b.c" },
  };

  const instance: MockSupabase = {
    auth: {
      signInWithPassword: async (_opts) => {
        throw new Error("signInWithPassword not configured for this test — set .signInWithPassword on the mock");
      },
      signUp: async (_opts) => {
        throw new Error("signUp not configured for this test — set .signUp on the mock");
      },
      resetPasswordForEmail: async (_email, _opts) => ({ error: null }),
      updateUser: async (_opts) => {
        throw new Error("updateUser not configured for this test — set .updateUser on the mock");
      },
      getSession: async () => ({ data: { session: session }, error: null }),
      signOut: async () => {
        session.access_token = "";
        session.user = null;
        return { error: null };
      },
    },
  };

  return instance;
}
