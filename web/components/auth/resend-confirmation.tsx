"use client";
import { useEffect, useState } from "react";
import { CheckCircle2, MailPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { supabase } from "@/lib/supabase/client";
import { SITE_URL } from "@/lib/site";

const COOLDOWN_SECONDS = 60;

/**
 * Resends the sign-up confirmation email. Supabase rate-limits this per address, so the button
 * cools down after each attempt and the rate-limit error is explained rather than swallowed.
 */
export function ResendConfirmation({ defaultEmail = "" }: { defaultEmail?: string }) {
  const [email, setEmail] = useState(defaultEmail);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = window.setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => window.clearTimeout(id);
  }, [cooldown]);

  async function resend(e: React.FormEvent) {
    e.preventDefault();
    const address = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(address)) {
      setError("Enter the email address you signed up with.");
      return;
    }
    setBusy(true);
    setError(null);
    setSent(false);
    try {
      const { error: sendError } = await supabase().auth.resend({
        type: "signup",
        email: address,
        options: {
          emailRedirectTo: `${SITE_URL}/auth/confirm?next=${encodeURIComponent("/onboarding")}`,
        },
      });
      if (sendError) {
        if (sendError.code === "over_email_send_rate_limit" || sendError.status === 429) {
          setError("Our email sender is rate-limited right now, so nothing was sent. Please try again in a few minutes.");
        } else if (sendError.code === "user_not_found") {
          setError("We couldn't find an account with that email. Try creating one instead.");
        } else {
          setError("We couldn't send the email just now. Please try again in a moment.");
        }
        return;
      }
      setSent(true);
      setCooldown(COOLDOWN_SECONDS);
    } catch {
      setError("We couldn't send the email just now. Please try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={resend} className="mt-3 space-y-2" noValidate>
      <label htmlFor="resend-email" className="block text-sm font-semibold">
        Need a new confirmation link?
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          id="resend-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(ev) => setEmail(ev.target.value)}
          className="sm:flex-1"
        />
        <Button type="submit" variant="outline" loading={busy} disabled={cooldown > 0}>
          <MailPlus className="size-4" aria-hidden />
          {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend link"}
        </Button>
      </div>
      {sent && (
        <div role="status" className="space-y-1 text-sm">
          <p className="flex items-start gap-2 font-medium text-emerald-ink">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
            The email sender accepted the request. Check your inbox and spam for a fresh link — it
            expires, so open it soon after it arrives.
          </p>
          <p className="text-slate">
            If it has not arrived within a couple of minutes, our email sender is probably throttled.
            Wait a few minutes, then try again.
          </p>
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm font-medium text-red">
          {error}
        </p>
      )}
    </form>
  );
}
