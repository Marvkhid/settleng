"use client";
import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { supabase } from "@/lib/supabase/client";

function messageFor(code: string, fallback: string): string {
  if (code === "invalid_credentials") return "That email and password don't match. Please try again.";
  if (code === "email_not_confirmed") return "Please confirm your email first, then log in.";
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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase().auth.signInWithPassword({ email: email.trim(), password });
      if (error) {
        toast.error(messageFor(error.code ?? "", error.message));
        return;
      }
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
      {checkEmail && (
        <p className="mb-5 rounded-xl bg-emerald-wash p-3 text-sm font-medium text-emerald-ink">
          Almost there — check your email to confirm your account, then log in here.
        </p>
      )}
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field label="Email" htmlFor="email">
          <Input id="email" name="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        </Field>
        <Field label="Password" htmlFor="password">
          <Input id="password" name="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
        </Field>
        <div className="flex justify-end">
          <Link href="/forgot-password" className="text-sm font-semibold text-emerald-ink underline-offset-4 hover:underline">
            Forgot your password?
          </Link>
        </div>
        <Button type="submit" size="lg" className="w-full" loading={busy}>
          Log in
        </Button>
      </form>
    </AuthShell>
  );
}
