"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { supabase } from "@/lib/supabase/client";

/**
 * Sets a new password from the emailed reset link. Supabase puts the recovery session in the URL
 * hash, so `getSession()` picks it up and `updateUser` applies the new password.
 */
export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

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
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field label="New password" htmlFor="password" hint="At least 6 characters.">
          <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={busy}>
          Save password
        </Button>
      </form>
    </AuthShell>
  );
}
