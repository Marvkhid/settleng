import "@testing-library/jest-dom";
import { vi } from "vitest";

// ---- Env stubs for browser-only modules that read env at runtime. ----
// Auth pages read NEXT_PUBLIC_SUPABASE_URL/ANON_KEY and NEXT_PUBLIC_API_URL. In unit tests we
// don't have a real Supabase, so provide placeholder values and override the supabase/client
// and api-client modules in the individual tests with controllable mocks.
if (typeof process !== "undefined" && process.env) {
  const env = process.env;
  if (!env.NEXT_PUBLIC_SUPABASE_URL) env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
  if (!env.NEXT_PUBLIC_SUPABASE_ANON_KEY) env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
  if (!env.NEXT_PUBLIC_API_URL) env.NEXT_PUBLIC_API_URL = "http://localhost:4000";
}

// ---- Next navigation hooks mock. ----
// Client components import useRouter()/useSearchParams() from next/navigation. In jsdom those
// hooks have no router context, so we provide a controllable mock that every auth-page/provider
// test can drive. The mock objects are mutable so individual tests can set .replace behavior.
export const mockRouter = {
  replace: vi.fn(() => Promise.resolve()),
  push: vi.fn(() => Promise.resolve()),
  prefetch: vi.fn(() => Promise.resolve()),
  back: vi.fn(),
  forward: vi.fn(),
  refresh: vi.fn(),
  events: { on: vi.fn(), off: vi.fn(), emit: vi.fn() },
} as const;
const mockSearchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => mockRouter as unknown as ReturnType<typeof import("next/navigation").useRouter>,
  useSearchParams: () => new URLSearchParams(mockSearchParams) as unknown as ReturnType<typeof import("next/navigation").useSearchParams>,
  usePathname: () => "/" as unknown as ReturnType<typeof import("next/navigation").usePathname>,
  // Next 16 also re-exports Link from next/link; leave the real module for that.
}));

// Polyfill APIs jsdom is missing that the app or test utilities may touch.
if (typeof requestAnimationFrame === "undefined") {
  globalThis.requestAnimationFrame = (cb: FrameRequestCallback) => setTimeout(cb, 0);
}
if (typeof cancelAnimationFrame === "undefined") {
  globalThis.cancelAnimationFrame = (id: number) => clearTimeout(id);
}

// ---- Auth-page test harness state. ----
// The mutable Supabase and api mocks live on globalThis so the hoisted vi.mock factories in
// auth-pages.test.tsx can reach them without introducing per-file module-scope bindings that
// would trigger a TDZ error when another module under test imports the mocked API client.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function authGlobalThis() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return globalThis as any;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const g = authGlobalThis();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface TestSupabase {
  auth: {
    signInWithPassword: typeof vi.fn;
    signUp: typeof vi.fn;
    resetPasswordForEmail: (email: string, opts: { redirectTo: string }) => Promise<{ error: { code: string; message: string } | null }>;
    updateUser: (opts: { password: string }) => Promise<{ error: { message: string } | null }>;
    getSession: () => Promise<{ data: { session: { access_token: string; user: { id: string; email: string } | null } | null }; error: null }>;
    signOut: () => Promise<{ error: { message: string } | null }>;
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function testSupabase(): TestSupabase {
  if (!g.__testSupabase) {
    g.__testSupabase = {
      auth: {
        signInWithPassword: vi.fn(),
        signUp: vi.fn(),
        resetPasswordForEmail: vi.fn<[string, { redirectTo: string }], Promise<{ error: { code: string; message: string } | null }>>().mockResolvedValue({ error: null }),
        updateUser: vi.fn<[{ password: string }, Promise<{ error: { message: string } | null }>]>().mockResolvedValue({ error: { message: "not configured" } }),
        getSession: vi.fn<[], Promise<{ data: { session: { access_token: string; user: { id: string; email: string } | null } | null }; error: null }>>().mockResolvedValue({ data: { session: { access_token: "mock-access-token", user: { id: "u1", email: "a@b.c" } } }, error: null }),
        signOut: vi.fn<[], Promise<{ error: { message: string } | null }>>().mockResolvedValue({ error: null }),
      },
    };
  }
  return g.__testSupabase;
}

export function setSupabaseAuth(auth: TestSupabase["auth"]) {
  g.__testSupabase = g.__testSupabase ?? {
    auth: {
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      resetPasswordForEmail: async (_email, _opts) => ({ error: null }),
      updateUser: async (_opts) => ({ error: { message: "not configured" } }),
      getSession: async () => ({ data: { session: { access_token: "mock-access-token", user: { id: "u1", email: "a@b.c" } } }, error: null }),
      signOut: async () => ({ error: null }),
    },
  };
  g.__testSupabase.auth = auth;
}

export function resetSupabaseAuth() {
  const sup = testSupabase();
  sup.auth.signInWithPassword.mockClear();
  sup.auth.signUp.mockClear();
  sup.auth.resetPasswordForEmail = async (_email, _opts) => ({ error: null });
  sup.auth.updateUser = async (_opts) => ({ error: { message: "not configured" } });
  sup.auth.signOut = async () => ({ error: null });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface TestApiMock {
  me: typeof vi.fn;
  bootstrap: typeof vi.fn;
  updateProfile: typeof vi.fn;
  deleteAccount: typeof vi.fn;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function testApiMock(): TestApiMock {
  if (!g.__testApiMock) {
    g.__testApiMock = {
      me: vi.fn(),
      bootstrap: vi.fn(),
      updateProfile: vi.fn(),
      deleteAccount: vi.fn(),
    };
  }
  return g.__testApiMock;
}

export function resetTestApiMock() {
  const m = testApiMock();
  m.me.mockClear();
  m.bootstrap.mockClear();
  m.updateProfile.mockClear();
  m.deleteAccount.mockClear();
}

export function setSearchParams(search: string) {
  mockSearchParams.forEach((_v, _k) => mockSearchParams.delete(_k));
  for (const [k, v] of new URLSearchParams(search)) {
    mockSearchParams.set(k, v);
  }
}

export function clearRouterCalls() {
  for (const k of Object.keys(mockRouter)) {
    if (typeof mockRouter[k] === "function") mockRouter[k].mockClear();
  }
}
