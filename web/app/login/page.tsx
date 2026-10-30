"use client";
import { Suspense, useCallback, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, MailCheck } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
import { Turnstile, captchaConfigured } from "@/components/auth/turnstile";
import { ResendConfirmation } from "@/components/auth/resend-confirmation";
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
  if (code === "email_not_confirmed") return "This account still needs its email confirmed.";
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
  const checkEmail = params.get("checkEmail") === "1";
  const authError = params.get("authError");
  const emailParam = params.get("email") ?? "";
  const [email, setEmail] = useState(emailParam);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [needsConfirm, setNeedsConfirm] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaRound, setCaptchaRound] = useState(0);
  const handleCaptcha = useCallback((token: string | null) => setCaptchaToken(token), []);

  const linkMessage = authError
    ? (LINK_ERRORS[authError] ?? "That sign-in link didn't work. Please request a new one below.")
    : null;
  const showResend = checkEmail || Boolean(authError) || needsConfirm;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (captchaConfigured() && !captchaToken) {
      toast.error("Please finish the security check first.");
      return;
    }
    setBusy(true);
    setNeedsConfirm(false);
    try {
      const { error } = await supabase().auth.signInWithPassword({
        email: email.trim(),
        password,
        ...(captchaToken ? { options: { captchaToken } } : {}),
      });
      if (error) {
        if (error.code === "email_not_confirmed") setNeedsConfirm(true);
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
            Send yourself a new link below, then open it once, straight after it arrives.
          </p>
        </div>
      )}

      {checkEmail && !linkMessage && (
        <p className="mb-5 flex items-start gap-2 rounded-xl border border-emerald/25 bg-emerald-wash p-3 text-sm font-medium text-emerald-ink">
          <MailCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
          Account created. Open the confirmation link we emailed you, then log in here.
        </p>
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

      {showResend && <ResendConfirmation defaultEmail={email} />}
    </AuthShell>
  );
}
