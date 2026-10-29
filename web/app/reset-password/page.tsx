"use client";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { supabase } from "@/lib/supabase/client";

/**
 * Sets a new password from the emailed reset link.
 *
 * Supabase can hand the recovery session over in two shapes depending on the flow configured for
 * the project: a `?code=` query parameter (PKCE) or an `#access_token=` hash (implicit). Both are
 * handled here, and a link that arrives without either — expired, or opened twice — explains
 * itself and offers a fresh one instead of showing a broken form.
 */
export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetForm />
    </Suspense>
  );
}

type LinkState = "checking" | "ready" | "invalid";

function messageForSearch(search: URLSearchParams): string {
  const code = search.get("error_code") ?? search.get("error");
  if (code === "otp_expired") return "That reset link has expired, or was already used once.";
  if (code) return "That reset link is no longer valid.";
  return "That reset link is incomplete or has expired.";
}

function ResetForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [state, setState] = useState<LinkState>("checking");
  const [message, setMessage] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function resolveSession() {
      const suppliedError = params.get("error_code") ?? params.get("error");
      if (suppliedError) {
        if (!cancelled) {
          setMessage(messageForSearch(new URLSearchParams(params.toString())));
          setState("invalid");
        }
        return;
      }

      const supabaseClient = supabase();
      const code = params.get("code");
      if (code) {
        const { error } = await supabaseClient.auth.exchangeCodeForSession(code);
        if (cancelled) return;
        if (error) {
          setMessage("That reset link has expired, or was already used once.");
          setState("invalid");
          return;
        }
        setState("ready");
        return;
      }

      // Implicit flow: the browser client reads the tokens out of the URL hash itself.
      const { data } = await supabaseClient.auth.getSession();
      if (cancelled) return;
      setState(data.session ? "ready" : "invalid");
      if (!data.session) setMessage("That reset link is incomplete or has expired.");
    }

    void resolveSession();
    return () => {
      cancelled = true;
    };
  }, [params]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase().auth.updateUser({ password });
      if (error) {
        toast.error(error.message || "We couldn't update your password. Please try again.");
        return;
      }
      toast.success("Password updated. You're logged in.");
      router.replace("/dashboard");
    } catch {
      toast.error("We couldn't update your password. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Set a new password"
      subtitle="Choose a password you'll remember."
      footer={
        <>
          <Link href="/login" className="font-semibold text-emerald-ink underline-offset-4 hover:underline">
            Back to log in
          </Link>
        </>
      }
    >
      {state === "checking" && (
        <p role="status" className="text-slate">
          Checking your link…
        </p>
      )}

      {state === "invalid" && (
        <div role="alert" className="space-y-3">
          <p className="rounded-xl border border-red-200 bg-red-wash p-3 font-medium text-ink">
            {message}
          </p>
          <p className="text-slate">
            Links can only be opened once. Request a fresh one and open it straight away.
          </p>
          <Link
            href="/forgot-password"
            className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-emerald-ink px-5 font-semibold text-white hover:bg-emerald-deep"
          >
            Send me a new reset link
          </Link>
        </div>
      )}

      {state === "ready" && (
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <Field label="New password" htmlFor="password" hint="At least 6 characters.">
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </Field>
          <Button type="submit" size="lg" className="w-full" loading={busy}>
            Save password
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
