"use client";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { ResendConfirmation } from "@/components/auth/resend-confirmation";
import { supabase } from "@/lib/supabase/client";

/**
 * Fallback for email links whose tokens arrive in the URL hash (`#access_token=...`). A server route
 * cannot see a hash, so this client page reads the session the Supabase browser client picked up
 * from it. If there is no session, the link was expired, incomplete or already used — say so and
 * offer a fresh one rather than bouncing the person through an error page.
 */
export default function AuthCompletePage() {
  return (
    <Suspense fallback={null}>
      <Complete />
    </Suspense>
  );
}

function safeNext(raw: string | null, fallback = "/dashboard"): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return fallback;
  return raw;
}

/** A recovery link carries `type=recovery` in the hash; those must open the reset form. */
function hashIsRecovery(): boolean {
  if (typeof window === "undefined") return false;
  const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "";
  return new URLSearchParams(hash).get("type") === "recovery";
}

function Complete() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"), hashIsRecovery() ? "/reset-password" : "/dashboard");
  const [state, setState] = useState<"checking" | "invalid">("checking");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // detectSessionInUrl handles the hash; getSession returns whatever was established.
      const { data } = await supabase().auth.getSession();
      if (cancelled) return;
      if (data.session) {
        router.replace(next);
        router.refresh();
        return;
      }
      setState("invalid");
    })();
    return () => {
      cancelled = true;
    };
  }, [next, router]);

  return (
    <AuthShell
      title={state === "checking" ? "Confirming your link" : "This link didn't work"}
      subtitle={state === "checking" ? "This only takes a moment." : "Let's get you a fresh one."}
    >
      {state === "checking" ? (
        <p role="status" className="text-slate">
          Signing you in…
        </p>
      ) : (
        <div role="alert" className="space-y-3">
          <p className="rounded-xl border border-red-200 bg-red-wash p-3 font-medium text-ink">
            That link has expired, or it was already used once. Confirmation links only work a single
            time.
          </p>
          <ResendConfirmation />
          <p className="text-center text-sm text-slate">
            Already confirmed?{" "}
            <Link href="/login" className="font-semibold text-emerald-ink underline-offset-4 hover:underline">
              Log in
            </Link>
          </p>
        </div>
      )}
    </AuthShell>
  );
}
