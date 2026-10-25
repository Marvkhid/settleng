"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase/client";
import { api, ApiError } from "@/lib/api-client";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { ConfirmDialog } from "@/components/ui/dialog";
import { PageHeader } from "@/components/shell/page-header";

function messageFor(code: string, fallback: string): string {
  if (code === "email_exists") return "That email is already in use by another account.";
  if (code === "weak_password") return "Please choose a password of at least 6 characters.";
  return fallback;
}

export function SettingsForm() {
  const { me, firstName, businessName, refresh } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  // null until the owner types: the field then follows the saved name from AuthProvider, so a
  // background refresh never overwrites unsaved typing and no effect has to sync state.
  const [draftName, setDraftName] = useState<string | null>(null);
  const bizName = draftName ?? businessName ?? "";
  const [nameError, setNameError] = useState<string | undefined>();
  const [savingName, setSavingName] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [busy, startTransition] = useTransition();

  useEffect(() => {
    supabase()
      .auth.getUser()
      .then(({ data }) => { if (data.user) setEmail(data.user.email ?? ""); })
      .catch(() => {});
  }, []);

  async function saveBusinessName(e: React.FormEvent) {
    e.preventDefault();
    const name = bizName.trim();
    if (!name) { setNameError("Enter your business name."); return; }
    if (name.length > 120) { setNameError("Keep the name under 120 characters."); return; }
    if (name === businessName) { toast.success("Your business name is already saved."); return; }
    setNameError(undefined);
    setSavingName(true);
    try {
      const saved = await api.updateBusiness({ name });
      setDraftName(saved.business.name);
      // Refresh the signed-in user so the sidebar, dashboard and greeting show the new name now.
      refresh();
      toast.success("Business name updated");
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "We couldn't save your business name. Please try again.";
      setNameError(msg);
      toast.error(msg);
    } finally {
      setSavingName(false);
    }
  }

  async function changeEmail(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        const { error } = await supabase().auth.updateUser({ email: email.trim() });
        if (error) {
          toast.error(messageFor(error.code ?? "", error.message));
          return;
        }
        toast.success("Email updated. You'll use it to sign in from now on.");
      } catch {
        toast.error("We couldn't update your email. Please try again.");
      }
    });
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error("The two passwords don't match.");
      return;
    }
    startTransition(async () => {
      try {
        const { error } = await supabase().auth.updateUser({ password: newPassword });
        if (error) {
          toast.error(messageFor(error.code ?? "", error.message));
          return;
        }
        toast.success("Password changed.");
        setNewPassword("");
        setConfirmPassword("");
      } catch {
        toast.error("We couldn't change your password. Please try again.");
      }
    });
  }

  async function deleteAccount() {
    setDeleteLoading(true);
    try {
      await api.deleteAccount?.();
      toast.success("Your account has been deleted.");
      await supabase().auth.signOut();
      router.replace("/login");
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "We couldn't delete your account. Please try again.";
      toast.error(msg);
    } finally {
      setDeleteLoading(false);
      setDeleteDialogOpen(false);
    }
  }

  return (
    <>
      <PageHeader title="Settings" subtitle={firstName ? `Signed in as ${firstName}` : undefined} />
      <div className="max-w-2xl space-y-8">
        <section className="rounded-2xl border border-line bg-surface p-5">
          <h2 className="mb-4 text-lg font-extrabold tracking-tight">Account</h2>
          <div className="space-y-6">
            <form onSubmit={changeEmail} className="space-y-4" noValidate>
              <Field label="Email address" htmlFor="email" hint="Used to sign in and receive notifications.">
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </Field>
              <div className="flex justify-end">
                <Button type="submit" size="sm" loading={busy}>
                  Update email
                </Button>
              </div>
            </form>

            <form onSubmit={changePassword} className="space-y-4" noValidate>
              <Field label="Current password" htmlFor="currentPassword">
                <Input
                  id="currentPassword"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </Field>
              <Field label="New password" htmlFor="newPassword" hint="At least 6 characters.">
                <Input
                  id="newPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </Field>
              <Field label="Confirm new password" htmlFor="confirmPassword">
                <Input
                  id="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={6}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </Field>
              <div className="flex justify-end">
                <Button type="submit" variant="outline" size="sm" loading={busy}>
                  Change password
                </Button>
              </div>
            </form>
          </div>
        </section>

        <section className="rounded-2xl border border-line bg-surface p-5">
          <h2 className="mb-4 text-lg font-extrabold tracking-tight">Business</h2>
          <form onSubmit={saveBusinessName} className="space-y-4" noValidate>
            <Field
              label="Business name"
              htmlFor="business-name"
              error={nameError}
              hint="Shown on your dashboard and across the app. You can change it whenever you like."
            >
              <Input
                id="business-name"
                name="businessName"
                autoComplete="organization"
                maxLength={120}
                value={bizName}
                onChange={(e) => { setDraftName(e.target.value); if (nameError) setNameError(undefined); }}
                placeholder="e.g. Marvel Fabrics"
              />
            </Field>
            <div className="flex justify-end">
              <Button type="submit" size="sm" loading={savingName}>
                {savingName ? "Saving…" : "Save business name"}
              </Button>
            </div>
          </form>
          <dl className="mt-4 divide-y divide-line overflow-hidden border-t border-line">
            <div className="flex justify-between gap-4 py-4 last:pb-0">
              <dt className="font-semibold">Currency</dt>
              <dd className="text-ink-soft">
                {me?.business?.currency === "NGN" ? "Nigerian naira (₦)" : me?.business?.currency ?? "Nigerian naira (₦)"}
              </dd>
            </div>
            <div className="flex justify-between gap-4 py-4 last:pb-0">
              <dt className="font-semibold">Business hours</dt>
              <dd className="text-ink-soft">Greetings follow West Africa Time (Africa/Lagos)</dd>
            </div>
          </dl>
        </section>

        <section>
          <h2 className="mb-1 text-lg font-extrabold tracking-tight text-red">Danger zone</h2>
          <p className="mb-4 text-sm text-slate">
            Permanently delete your account and all of your business data. This can&apos;t be undone.
          </p>
          <Button variant="dangerOutline" size="sm" onClick={() => setDeleteDialogOpen(true)}>
            Delete account
          </Button>
        </section>

        <p className="rounded-2xl bg-sunken p-4 text-sm text-slate">
          SettleNG records what you enter. It does not connect to banks, hold money or process payments.
        </p>
      </div>

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete your account?"
        description="This will permanently delete your business, customers, invoices, transactions and your sign-in account. This can't be undone."
        confirmLabel="Delete my account"
        destructive
        loading={deleteLoading}
        onConfirm={deleteAccount}
      />
    </>
  );
}
