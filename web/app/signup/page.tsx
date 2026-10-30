"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { api } from "@/lib/api-client";
import { supabase } from "@/lib/supabase/client";

/** Friendly, specific messages for the sign-up errors people actually hit. */
function messageFor(code: string, fallback: string): string {
  if (code === "email_exists") return "An account with this email already exists. Try logging in.";
  if (code === "weak_password") return "Please choose a password of at least 6 characters.";
  if (code === "email_address_invalid") return "That email address was rejected. Please check it and try again.";
  // Supabase rejects the whole sign-up with a 429 when its email sender is rate-limited, so no
  // account exists afterwards. Saying "try again" without that detail is what makes people assume
  // they registered and keep waiting for an email that was never sent.
  if (code === "over_email_send_rate_limit")
    return "Our email sender is rate-limited right now, so your account was not created. Please try again in a few minutes.";
  return fallback;
}

export default function SignupPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { data, error } = await supabase().auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { full_name: fullName.trim(), business_name: businessName.trim() },
          // Send confirmation links back to THIS deployment's callback route, not the provider's
          // default. The route verifies the token server-side and only then creates a session.
          emailRedirectTo: `${window.location.origin}/auth/confirm?next=${encodeURIComponent("/onboarding")}`,
        },
      });
      if (error) {
        toast.error(messageFor(error.code ?? "", error.message), { duration: 8000 });
        return;
      }
      // If email confirmation is on, there is no session yet — send them to a check-your-inbox note.
      if (!data.session) {
        toast.success("Account created. Check your email for the confirmation link.");
        router.replace(`/login?checkEmail=1&email=${encodeURIComponent(email.trim())}`);
        return;
      }
      // Create the Profile + Business on the API, then land in the dashboard.
      await api.bootstrap({ fullName: fullName.trim(), businessName: businessName.trim() });
      toast.success("Welcome to SettleNG!");
      router.replace("/dashboard");
    } catch {
      toast.error("We couldn't finish setting up your account. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="Start tracking sales, expenses and customer debts in minutes."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-emerald-ink underline-offset-4 hover:underline">
            Log in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field label="Full name" htmlFor="fullName">
          <Input id="fullName" name="fullName" autoComplete="name" required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Marvel Okafor" />
        </Field>
        <Field label="Business name" htmlFor="businessName">
          <Input id="businessName" name="businessName" autoComplete="organization" required value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="Marvel Stores" />
        </Field>
        <Field label="Email" htmlFor="email">
          <Input id="email" name="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        </Field>
        <Field label="Password" htmlFor="password" hint="At least 6 characters.">
          <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={busy}>
          Create account
        </Button>
      </form>
    </AuthShell>
  );
}
