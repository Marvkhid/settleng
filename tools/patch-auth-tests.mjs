import { readFileSync, writeFileSync } from 'node:fs';

const file = 'web/test/auth-pages.test.tsx';
let s = readFileSync(file, 'utf8');
let bad = 0;
const edit = (a, b) => {
  if (!s.includes(a)) {
    console.error('MISSING: ' + a.split('\n')[0].slice(0, 90));
    bad++;
    return;
  }
  s = s.replace(a, b);
};

// 1. login: unconfirmed accounts get a deliberately non-enumerating message (no "confirm your email").
edit(
  'await waitFor(() => expect(screen.getByText(/please confirm your email first/i)).toBeInTheDocument());',
  "await waitFor(() => expect(screen.getByText(/isn't active yet/i)).toBeInTheDocument());",
);

// 2. login: the sign-up page hands over ?email=, not ?checkEmail=.
edit(
  `  it("shows a check-your-email note when the checkEmail param is set", () => {
    setSearchParams("?checkEmail=1");
    render(<LoginPage />, { wrapper: ({ children }) => <><Toaster richColors />{children}</> });
    expect(screen.getByText(/almost there/i)).toBeInTheDocument();
  });`,
  `  it("prefills the email address handed over by the sign-up page", () => {
    setSearchParams("?email=me%40example.com");
    render(<LoginPage />, { wrapper: ({ children }) => <><Toaster richColors />{children}</> });
    expect((screen.getByLabelText("Email") as HTMLInputElement).value).toBe("me@example.com");
  });`,
);

// 3. sign-up now also sends emailRedirectTo (and a captcha token when configured).
edit(
  `    expect(testSupabase().auth.signUp).toHaveBeenCalledWith({
      email: "me@example.com",
      password: "secret12",
      options: { data: { full_name: "Marvel Okafor", business_name: "Marvel Stores" } },
    });`,
  `    expect(testSupabase().auth.signUp).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "me@example.com",
        password: "secret12",
        options: expect.objectContaining({
          data: { full_name: "Marvel Okafor", business_name: "Marvel Stores" },
        }),
      }),
    );`,
);

// 4. sign-up without a session explains it did not send a link, and returns to login with the email.
edit(
  `    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith("/login?checkEmail=1"));
    expect(await screen.findByText(/almost there/i)).toBeInTheDocument(); // email confirmation path`,
  `    await waitFor(() =>
      expect(mockRouter.replace).toHaveBeenCalledWith("/login?email=me%40example.com"),
    );
    expect(
      await screen.findByText(/your account was created, but we couldn't sign you in yet/i),
    ).toBeInTheDocument();`,
);

// 5. forgot password success copy.
edit(
  "expect(await screen.findByText(/we've sent a link/i)).toBeInTheDocument();",
  'expect(await screen.findByText(/a reset link is on its way/i)).toBeInTheDocument();',
);

// 6. reset password: the form appears after the emailed link is checked.
edit(
  `  it("renders the new password field and a save button", () => {
    render(<ResetPasswordPage />, { wrapper: ({ children }) => <><Toaster richColors />{children}</> });
    expect(screen.getByLabelText("New password")).toBeInTheDocument();`,
  `  it("renders the new password field and a save button", async () => {
    render(<ResetPasswordPage />, { wrapper: ({ children }) => <><Toaster richColors />{children}</> });
    expect(await screen.findByLabelText("New password")).toBeInTheDocument();`,
);
edit(
  `    render(<ResetPasswordPage />, { wrapper: ({ children }) => <><Toaster richColors />{children}</> });
    testSupabase().auth.updateUser = vi.fn().mockResolvedValue({ error: null });`,
  `    render(<ResetPasswordPage />, { wrapper: ({ children }) => <><Toaster richColors />{children}</> });
    await screen.findByLabelText("New password");
    testSupabase().auth.updateUser = vi.fn().mockResolvedValue({ error: null });`,
);
edit(
  `    render(<ResetPasswordPage />, { wrapper: ({ children }) => <><Toaster richColors />{children}</> });
    testSupabase().auth.updateUser = vi.fn().mockResolvedValue({ error: { message: "Too weak" } });`,
  `    render(<ResetPasswordPage />, { wrapper: ({ children }) => <><Toaster richColors />{children}</> });
    await screen.findByLabelText("New password");
    testSupabase().auth.updateUser = vi.fn().mockResolvedValue({ error: { message: "Too weak" } });`,
);

writeFileSync(file, s);
console.log(bad === 0 ? 'PATCH_OK' : 'PATCH_FAIL=' + bad);
