"use client";
import { Suspense, useCallback, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
import { Turnstile, captchaConfigured } from "@/components/auth/turnstile";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { supabase } from "@/lib/supabase/client";

/** Plain-English explanation for each failure code a Supabase email link can report. */
const LINK_ERRORS: Record<string, string> = {
  otp_expired:
    "That confirmation link has expired, or it was already used once. Links can only be opened a single time.",
  access_denied:
    "That link was no longer valid. It may have expired, or been opened on a different device after it was used.",
  missing_token: "That link was incomplete — part of it was lost on the way here.",
  verification_failed: "We couldn't verify that link. Please request a fresh one.",
};

function messageFor(code: string, fallback: string): string {
  if (code === "invalid_credentials") return "That email and password don't match. Please try again.";
  if (code === "email_not_confirmed")
    return "That email and password don't match, or this account isn't active yet. Please try again.";
  if (code === "over_request_rate_limit") return "Too many attempts. Please wait a minute and try again.";
  return fallback;
}

export default function LoginPage() {
  // useSearchParams() requires a Suspense boundary for static prerendering.
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/dashboard";
  const authError = params.get("authError");
  const emailParam = params.get("email") ?? "";
  const [email, setEmail] = useState(emailParam);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaRound, setCaptchaRound] = useState(0);
  const handleCaptcha = useCallback((token: string | null) => setCaptchaToken(token), []);

  const linkMessage = authError
    ? (LINK_ERRORS[authError] ?? "That sign-in link didn't work. Please request a new one.")
    : null;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (captchaConfigured() && !captchaToken) {
      toast.error("Please finish the security check first.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase().auth.signInWithPassword({
        email: email.trim(),
        password,
        ...(captchaToken ? { options: { captchaToken } } : {}),
      });
      if (error) {
        toast.error(messageFor(error.code ?? "", error.message));
        setCaptchaToken(null);
        setCaptchaRound((r) => r + 1);
        return;
      }
      // Informational only, fired and forgotten: a mail failure must never keep anyone out.
      void fetch("/api/login-notice", { method: "POST" }).catch(() => {});
      router.replace(next);
      router.refresh();
    } catch {
      toast.error("We couldn't log you in. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Log in to pick up where you left off."
      footer={
        <>
          New to SettleNG?{" "}
          <Link href="/signup" className="font-semibold text-emerald-ink underline-offset-4 hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      {linkMessage && (
        <div role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-wash p-3 text-sm text-ink">
          <p className="flex items-start gap-2 font-semibold text-red">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            {linkMessage}
          </p>
          <p className="mt-1.5 text-ink-soft">
            If you were resetting a password, request a fresh reset link from the “Forgot your
            password?” page below.
          </p>
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field label="Email" htmlFor="email">
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </Field>
        <Field label="Password" htmlFor="password">
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </Field>
        <div className="flex justify-end">
          <Link
            href="/forgot-password"
            className="text-sm font-semibold text-emerald-ink underline-offset-4 hover:underline"
          >
            Forgot your password?
          </Link>
        </div>
        <Turnstile key={captchaRound} onToken={handleCaptcha} />
        <Button type="submit" size="lg" className="w-full" loading={busy}>
          Log in
        </Button>
      </form>
    </AuthShell>
  );
}
