"use client";
import { useCallback, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { AuthShell } from "@/components/auth/auth-shell";
import { Turnstile, captchaConfigured } from "@/components/auth/turnstile";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { supabase } from "@/lib/supabase/client";
import { SITE_URL } from "@/lib/site";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaRound, setCaptchaRound] = useState(0);
  const handleCaptcha = useCallback((token: string | null) => setCaptchaToken(token), []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (captchaConfigured() && !captchaToken) {
      toast.error("Please finish the security check first.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase().auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${SITE_URL}/reset-password`,
        ...(captchaToken ? { captchaToken } : {}),
      });
      if (error) {
        // A throttled sender means nothing was sent at all — saying "check your email" would leave
        // the person waiting for a message that never existed.
        toast.error(
          error.code === "over_email_send_rate_limit" || error.status === 429
            ? "Our email sender is rate-limited right now, so no reset email was sent. Please try again in a few minutes."
            : "We couldn't send the reset email. Please try again.",
          { duration: 8000 },
        );
        setCaptchaToken(null);
        setCaptchaRound((r) => r + 1);
        return;
      }
      setSent(true);
    } catch {
      toast.error("We couldn't send the reset email. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Reset your password"
      subtitle="We'll email you a secure link to set a new password."
      footer={
        <>
          Remembered it?{" "}
          <Link href="/login" className="font-semibold text-emerald-ink underline-offset-4 hover:underline">
            Log in
          </Link>
        </>
      }
    >
      {sent ? (
        <div className="rounded-xl bg-emerald-wash p-4">
          <p className="font-medium text-emerald-ink">
            If that address has an account, a reset link is on its way.
          </p>
          <p className="mt-2 text-sm text-ink-soft">
            Open it once, soon after it arrives — the link works a single time. If nothing comes
            within a few minutes, our email sender may be throttled; try again shortly.
          </p>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <Field label="Email" htmlFor="email">
            <Input id="email" name="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </Field>
          <Turnstile key={captchaRound} onToken={handleCaptcha} />
          <Button type="submit" size="lg" className="w-full" loading={busy}>
            Send reset link
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
