import { describe, expect, it, beforeEach, vi } from "vitest";
import { render, screen, waitFor, renderHook, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Toaster, toast } from "sonner";

import LoginPage from "@/app/login/page";
import SignupPage from "@/app/signup/page";
import ForgotPasswordPage from "@/app/forgot-password/page";
import ResetPasswordPage from "@/app/reset-password/page";
import { AuthProvider, useAuth } from "@/components/auth/auth-provider";
import { mockRouter, setSearchParams, clearRouterCalls } from "./setup";

// ---- Shared mock registry on globalThis so the hoisted vi.mock factories never close over
// module-scope bindings in this file. vi.mock validators reject factories that reference any
// per-file import or top-level const, so all harness state lives behind a globalThis accessor.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function testSupabase() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g = globalThis as any;
  if (!g.__testSupabase) {
    g.__testSupabase = {
      auth: {
        signInWithPassword: vi.fn(),
        signUp: vi.fn(),
        resetPasswordForEmail: vi.fn<[string, { redirectTo: string }], Promise<{ error: { code: string; message: string } | null }>>().mockResolvedValue({ error: null }),
        updateUser: vi.fn<[{ password: string }, Promise<{ error: { message: string } | null }>]>().mockResolvedValue({ error: { message: "not configured" } }),
        getSession: async () => ({ data: { session: { access_token: "mock-access-token", user: { id: "u1", email: "a@b.c" } } }, error: null }),
        signOut: async () => ({ error: null as { message: string } | null }),
      },
    };
  }
  return g.__testSupabase;
}

export function resetSupabaseAuth() {
  const sup = testSupabase();
  sup.auth.signInWithPassword.mockClear();
  sup.auth.signUp.mockClear();
  sup.auth.resetPasswordForEmail = vi.fn().mockResolvedValue({ error: null });
  sup.auth.updateUser = vi.fn().mockResolvedValue({ error: { message: "not configured" } });
  sup.auth.signOut = async () => ({ error: null });
}

export function testApiMock() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g = globalThis as any;
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

vi.mock("@/lib/supabase/client", () => ({
  supabase: () => testSupabase(),
}));

vi.mock("@/lib/api-client", () => ({
  api: testApiMock(),
  ApiError: class ApiError extends Error {
    status: number;
    details?: string[];
    constructor(status: number, message: string, details?: string[]) {
      super(message);
      this.status = status;
      this.name = "ApiError";
      this.details = details;
    }
    get isNotFound() {
      return this.status === 404;
    }
  },
}));

beforeEach(() => {
  // sonner keeps a module-level toast store; dismiss everything so a fresh Toaster in the
  // next test does not re-render toasts fired by earlier tests.
  toast.dismiss();
});

async function fillField(label: string, value: string, user: ReturnType<typeof userEvent.setup>) {
  const input = screen.getByLabelText(label) as HTMLInputElement;
  await user.clear(input);
  await user.type(input, value);
}

describe("login page", () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
    setSearchParams("");
    resetTestApiMock();
    resetSupabaseAuth();
    clearRouterCalls();
  });

  it("renders the email and password fields and a log in button", () => {
    render(<LoginPage />, { wrapper: ({ children }) => <><Toaster richColors />{children}</> });
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /log in/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /forgot your password/i })).toHaveAttribute("href", "/forgot-password");
    expect(screen.getByRole("link", { name: /create an account/i })).toHaveAttribute("href", "/signup");
  });

  it("signs in and navigates on valid credentials", async () => {
    render(<LoginPage />, { wrapper: ({ children }) => <><Toaster richColors />{children}</> });
    testSupabase().auth.signInWithPassword = vi.fn().mockResolvedValue({ data: null, error: null });
    await fillField("Email", "me@example.com", user);
    await fillField("Password", "secret", user);
    await user.click(screen.getByRole("button", { name: /log in/i }));
    await waitFor(() => expect(testSupabase().auth.signInWithPassword).toHaveBeenCalledWith({
      email: "me@example.com",
      password: "secret",
    }));
    expect(mockRouter.replace).toHaveBeenCalledWith("/dashboard");
    expect(mockRouter.refresh).toHaveBeenCalled(); // refresh is called on successful sign in
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows a friendly message for invalid credentials", async () => {
    render(<LoginPage />, { wrapper: ({ children }) => <><Toaster richColors />{children}</> });
    testSupabase().auth.signInWithPassword = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "invalid_credentials", message: "Bad credentials" },
    });
    await fillField("Email", "me@example.com", user);
    await fillField("Password", "wrong", user);
    await user.click(screen.getByRole("button", { name: /log in/i }));
    await waitFor(() => expect(screen.getByText(/that email and password don't match/i)).toBeInTheDocument());
  });

  it("shows a friendly message when the email isn't confirmed", async () => {
    render(<LoginPage />, { wrapper: ({ children }) => <><Toaster richColors />{children}</> });
    testSupabase().auth.signInWithPassword = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "email_not_confirmed", message: "Confirm your email" },
    });
    await fillField("Email", "me@example.com", user);
    await fillField("Password", "secret", user);
    await user.click(screen.getByRole("button", { name: /log in/i }));
    await waitFor(() => expect(screen.getByText(/please confirm your email first/i)).toBeInTheDocument());
  });

  it("shows a generic message for other errors", async () => {
    render(<LoginPage />, { wrapper: ({ children }) => <><Toaster richColors />{children}</> });
    testSupabase().auth.signInWithPassword = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "some_unknown_code", message: "Something went wrong" },
    });
    await fillField("Email", "me@example.com", user);
    await fillField("Password", "secret", user);
    await user.click(screen.getByRole("button", { name: /log in/i }));
    await waitFor(() => expect(screen.getByText(/something went wrong/i)).toBeInTheDocument());
  });

  it("navigates to the next param when provided", async () => {
    setSearchParams("?next=/invoices");
    render(<LoginPage />, { wrapper: ({ children }) => <><Toaster richColors />{children}</> });
    testSupabase().auth.signInWithPassword = vi.fn().mockResolvedValue({ data: null, error: null });
    await fillField("Email", "me@example.com", user);
    await fillField("Password", "secret", user);
    await user.click(screen.getByRole("button", { name: /log in/i }));
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalled());
    expect(mockRouter.replace).toHaveBeenCalledWith("/invoices"); // next param is honored
  });

  it("shows a check-your-email note when the checkEmail param is set", () => {
    setSearchParams("?checkEmail=1");
    render(<LoginPage />, { wrapper: ({ children }) => <><Toaster richColors />{children}</> });
    expect(screen.getByText(/almost there/i)).toBeInTheDocument();
  });
});

describe("signup page", () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
    setSearchParams("");
    clearRouterCalls();
    resetSupabaseAuth();
  });

  it("renders the full sign-up form", () => {
    render(<SignupPage />, { wrapper: ({ children }) => <><Toaster richColors />{children}</> });
    expect(screen.getByLabelText("Full name")).toBeInTheDocument();
    expect(screen.getByLabelText("Business name")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /create account/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /log in/i })).toHaveAttribute("href", "/login");
  });

  it("creates a Supabase account and bootstraps the business on success", async () => {
    render(<SignupPage />, { wrapper: ({ children }) => <><Toaster richColors />{children}</> });
    testSupabase().auth.signUp = vi.fn().mockResolvedValue({
      data: { user: { id: "u1", email: "me@example.com", app_metadata: {} }, session: { access_token: "tok", user: { id: "u1", email: "me@example.com" } } },
      error: null,
    });
    testApiMock().bootstrap.mockResolvedValue({
      userId: "u1",
      fullName: "Marvel Okafor",
      business: { id: "b1", name: "Marvel Stores", currency: "NGN" },
    });
    await fillField("Full name", "Marvel Okafor", user);
    await fillField("Business name", "Marvel Stores", user);
    await fillField("Email", "me@example.com", user);
    await fillField("Password", "secret12", user);
    await user.click(screen.getByRole("button", { name: /create account/i }));
    await waitFor(() => expect(testSupabase().auth.signUp).toHaveBeenCalled());
    expect(testSupabase().auth.signUp).toHaveBeenCalledWith({
      email: "me@example.com",
      password: "secret12",
      options: { data: { full_name: "Marvel Okafor", business_name: "Marvel Stores" } },
    });
    await waitFor(() => expect(testApiMock().bootstrap).toHaveBeenCalledWith({
      fullName: "Marvel Okafor",
      businessName: "Marvel Stores",
    }));
    expect(mockRouter.replace).toHaveBeenCalledWith("/dashboard");
  });

  it("sends to the check-your-inbox note when email confirmation is on", async () => {
    render(<SignupPage />, { wrapper: ({ children }) => <><Toaster richColors />{children}</> });
    testSupabase().auth.signUp = vi.fn().mockResolvedValue({
      data: { user: { id: "u1", email: "me@example.com", app_metadata: {} } },
      session: null,
      error: null,
    });
    await fillField("Full name", "Marvel Okafor", user);
    await fillField("Business name", "Marvel Stores", user);
    await fillField("Email", "me@example.com", user);
    await fillField("Password", "secret12", user);
    await user.click(screen.getByRole("button", { name: /create account/i }));
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith("/login?checkEmail=1"));
    expect(await screen.findByText(/almost there/i)).toBeInTheDocument(); // email confirmation path
  });

  it("shows a friendly message when the email already exists", async () => {
    render(<SignupPage />, { wrapper: ({ children }) => <><Toaster richColors />{children}</> });
    testSupabase().auth.signUp = vi.fn().mockResolvedValue({
      data: null,
      session: null,
      error: { code: "email_exists", message: "Email already used" },
    });
    await fillField("Full name", "Marvel Okafor", user);
    await fillField("Business name", "Marvel Stores", user);
    await fillField("Email", "me@example.com", user);
    await fillField("Password", "secret12", user);
    await user.click(screen.getByRole("button", { name: /create account/i }));
    await waitFor(() => expect(screen.getByText(/an account with this email already exists/i)).toBeInTheDocument());
  });
});

describe("forgot password page", () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
    setSearchParams("");
  });

  it("renders the email field and a send reset link button", () => {
    render(<ForgotPasswordPage />, { wrapper: ({ children }) => <><Toaster richColors />{children}</> });
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /send reset link/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /log in/i })).toHaveAttribute("href", "/login");
  });

  it("sends a reset email and shows a confirmation", async () => {
    render(<ForgotPasswordPage />, { wrapper: ({ children }) => <><Toaster richColors />{children}</> });
    await fillField("Email", "me@example.com", user);
    await user.click(screen.getByRole("button", { name: /send reset link/i }));
    await waitFor(() => expect(testSupabase().auth.resetPasswordForEmail).toHaveBeenCalledWith("me@example.com", {
      redirectTo: expect.stringContaining("/reset-password"),
    }));
    expect(await screen.findByText(/we've sent a link/i)).toBeInTheDocument();
  });

  it("shows a generic message when sending fails", async () => {
    render(<ForgotPasswordPage />, { wrapper: ({ children }) => <><Toaster richColors />{children}</> });
    testSupabase().auth.resetPasswordForEmail = vi.fn().mockResolvedValue({
      error: { code: "unknown", message: "Fail" },
    });
    await fillField("Email", "me@example.com", user);
    await user.click(screen.getByRole("button", { name: /send reset link/i }));
    await waitFor(() => expect(screen.getByText(/we couldn't send the reset email/i)).toBeInTheDocument());
  });
});

describe("reset password page", () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
    setSearchParams("");
  });

  it("renders the new password field and a save button", () => {
    render(<ResetPasswordPage />, { wrapper: ({ children }) => <><Toaster richColors />{children}</> });
    expect(screen.getByLabelText("New password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /save password/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /back to log in/i })).toHaveAttribute("href", "/login");
  });

  it("updates the password and navigates on success", async () => {
    render(<ResetPasswordPage />, { wrapper: ({ children }) => <><Toaster richColors />{children}</> });
    testSupabase().auth.updateUser = vi.fn().mockResolvedValue({ error: null });
    await fillField("New password", "newsecret12", user);
    await user.click(screen.getByRole("button", { name: /save password/i }));
    await waitFor(() => expect(testSupabase().auth.updateUser).toHaveBeenCalledWith({ password: "newsecret12" }));
    expect(mockRouter.replace).toHaveBeenCalledWith("/dashboard");
  });

  it("shows a message when the update fails", async () => {
    render(<ResetPasswordPage />, { wrapper: ({ children }) => <><Toaster richColors />{children}</> });
    testSupabase().auth.updateUser = vi.fn().mockResolvedValue({ error: { message: "Too weak" } });
    await fillField("New password", "123", user);
    await user.click(screen.getByRole("button", { name: /save password/i }));
    await waitFor(() => expect(screen.getByText(/too weak/i)).toBeInTheDocument());
  });
});

describe("auth provider", () => {
  beforeEach(() => {
    resetTestApiMock();
    vi.clearAllMocks();
    clearRouterCalls();
  });

  it("refreshes the user info when the provider mounts", async () => {
    testApiMock().me.mockResolvedValueOnce({
      userId: "u1",
      fullName: "Marvel Okafor",
      business: { id: "b1", name: "Marvel Stores", currency: "NGN" },
    });
    const { result } = renderHook(() => useAuth(), {
      wrapper: ({ children }) => <AuthProvider>{children}</AuthProvider>,
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.me).toEqual({
      userId: "u1",
      fullName: "Marvel Okafor",
      business: { id: "b1", name: "Marvel Stores", currency: "NGN" },
    });
    expect(result.current.firstName).toBe("Marvel");
    expect(result.current.businessName).toBe("Marvel Stores");
    expect(testApiMock().me).toHaveBeenCalledTimes(1);
  });

  it("reports nulls before onboarding finishes", async () => {
    testApiMock().me.mockResolvedValueOnce({
      userId: "u1",
      fullName: "Marvel Okafor",
      business: null,
    });
    const { result } = renderHook(() => useAuth(), {
      wrapper: ({ children }) => <AuthProvider>{children}</AuthProvider>,
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.me?.business).toBeNull();
    expect(result.current.businessName).toBeNull();
  });

  it("calls signOut and redirects to login", async () => {
    testApiMock().me.mockResolvedValueOnce({
      userId: "u1",
      fullName: "Marvel Okafor",
      business: { id: "b1", name: "Marvel Stores", currency: "NGN" },
    });
    const { result } = renderHook(() => useAuth(), {
      wrapper: ({ children }) => <AuthProvider>{children}</AuthProvider>,
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    testSupabase().auth.signOut = vi.fn().mockResolvedValue({ error: null });
    await act(async () => {
      await result.current.signOut();
    });
    await waitFor(() => expect(testSupabase().auth.signOut).toHaveBeenCalled());
    expect(mockRouter.replace).toHaveBeenCalledWith("/login");
  });

  it("calls refresh to re-fetch the user", async () => {
    testApiMock().me.mockResolvedValue({
      userId: "u1",
      fullName: "Marvel Okafor",
      business: { id: "b1", name: "Marvel Stores", currency: "NGN" },
    });
    const { result } = renderHook(() => useAuth(), {
      wrapper: ({ children }) => <AuthProvider>{children}</AuthProvider>,
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      result.current.refresh();
    });
    await waitFor(() => expect(testApiMock().me).toHaveBeenCalledTimes(2));
  });
});
