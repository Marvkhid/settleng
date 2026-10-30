"use client";
import { useCallback, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { AuthShell } from "@/components/auth/auth-shell";
import { Turnstile, captchaConfigured } from "@/components/auth/turnstile";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { supabase } from "@/lib/supabase/client";

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
        redirectTo: `${window.location.origin}/reset-password`,
        ...(captchaToken ? { captchaToken } : {}),
      });
      if (error) {
        toast.error("We couldn't send the reset email. Please try again.");
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
        <p className="rounded-xl bg-emerald-wash p-4 font-medium text-emerald-ink">
          Check your email — we&apos;ve sent a link to reset your password.
        </p>
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
