"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AuthProvider, useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { api } from "@/lib/api-client";

/**
 * First-run onboarding: names the business and the owner. Creates the Business + Profile via the
 * API (scoped to the signed-in user) and then sends them into the dashboard.
 */
export default function OnboardingPage() {
  // Onboarding lives outside the (app) group, so it brings its own provider.
  return (
    <AuthProvider>
      <OnboardingForm />
    </AuthProvider>
  );
}

function OnboardingForm() {
  const router = useRouter();
  const { me, loading, refresh } = useAuth();
  const [fullName, setFullName] = useState(me?.fullName ?? "");
  const [businessName, setBusinessName] = useState("");
  const [busy, setBusy] = useState(false);

  // If onboarding is already done, don't linger here.
  if (!loading && me?.business) {
    router.replace("/dashboard");
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.bootstrap({ fullName: fullName.trim(), businessName: businessName.trim() });
      toast.success("You're all set!");
      refresh();
      router.replace("/dashboard");
    } catch {
      toast.error("We couldn't save your business. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main id="main" className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-md rounded-3xl border border-line bg-surface p-6 shadow-xl sm:p-8">
        <h1 className="text-2xl font-extrabold tracking-tight">Set up your business</h1>
        <p className="mt-1 text-slate">Just a couple of details and you can start recording.</p>
        <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
          <Field label="Your full name" htmlFor="fullName">
            <Input id="fullName" autoComplete="name" required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Marvel Okafor" />
          </Field>
          <Field label="Business name" htmlFor="businessName">
            <Input id="businessName" autoComplete="organization" required value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="Marvel Stores" />
          </Field>
          <Button type="submit" size="lg" className="w-full" loading={busy || loading}>
            Continue to dashboard
          </Button>
        </form>
      </div>
    </main>
  );
}
