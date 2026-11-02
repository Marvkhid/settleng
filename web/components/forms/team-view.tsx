"use client";
import { useState } from "react";
import { toast } from "sonner";
import { ShieldCheck, UserPlus } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { ErrorState, Skeleton } from "@/components/ui/states";
import { useQuery } from "@/hooks/use-query";
import { api, ApiError } from "@/lib/api-client";

const ROLE_LABEL = { OWNER: "Owner", MANAGER: "Manager", STAFF: "Staff" } as const;

export function TeamView() {
  const { activeWorkspaceId, role, me } = useAuth();
  const members = useQuery(() => (activeWorkspaceId ? api.members(activeWorkspaceId) : Promise.resolve({ items: [] })), [activeWorkspaceId]);
  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"MANAGER" | "STAFF">("STAFF");
  const [busy, setBusy] = useState(false);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    if (!activeWorkspaceId) return;
    setBusy(true);
    try {
      await api.inviteMember(activeWorkspaceId, { email: email.trim(), role: inviteRole });
      toast.success("Invitation saved. It activates when they sign in with that email.");
      setEmail("");
      members.refetch();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "We couldn't send that invitation.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title="Team" subtitle="Who can see and act on this workspace." />

      <div className="mb-6 flex items-start gap-3 rounded-2xl border border-line bg-surface p-4 text-sm">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-emerald-ink" aria-hidden />
        <p className="text-ink-soft">
          Owners manage everything. Managers run finance and recovery. Staff only see debts assigned to them.
          You are signed in as <strong>{role ? ROLE_LABEL[role] : "member"}</strong> in this workspace.
        </p>
      </div>

      {role === "OWNER" && (
        <form onSubmit={invite} className="mb-6 grid gap-3 rounded-2xl border border-line bg-surface p-5 sm:grid-cols-[1fr_auto_auto] sm:items-end">
          <Field label="Email address" htmlFor="invite-email">
            <Input id="invite-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" />
          </Field>
          <Field label="Role" htmlFor="invite-role">
            <Select id="invite-role" value={inviteRole} onChange={(e) => setInviteRole(e.target.value as "MANAGER" | "STAFF")}>
              <option value="STAFF">Staff</option>
              <option value="MANAGER">Manager</option>
            </Select>
          </Field>
          <Button type="submit" loading={busy}><UserPlus className="size-4" aria-hidden /> Invite</Button>
        </form>
      )}

      {members.error ? (
        <ErrorState error={members.error} onRetry={members.refetch} />
      ) : !members.data ? (
        <Skeleton className="h-40" />
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
          {members.data.items.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center gap-3 px-4 py-4">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{m.email ?? m.userId ?? "Member"}</span>
                <span className="block text-sm text-slate">
                  {ROLE_LABEL[m.role]} · {m.status.toLowerCase()}
                  {m.status === "INVITED" ? " · activates on their next sign-in" : ""}
                  {m.userId === me?.userId ? " · you" : ""}
                </span>
              </span>
              {role === "OWNER" && m.role !== "OWNER" && (
                <span className="flex items-center gap-2">
                  <Select
                    aria-label={`Role for ${m.email ?? "member"}`}
                    className="h-10 w-32"
                    value={m.role}
                    onChange={async (e) => {
                      try {
                        await api.changeMemberRole(activeWorkspaceId!, m.id, { role: e.target.value as "MANAGER" | "STAFF" });
                        toast.success("Role updated");
                        members.refetch();
                      } catch (err) {
                        toast.error(err instanceof ApiError ? err.message : "We couldn't change that role.");
                      }
                    }}
                  >
                    <option value="MANAGER">Manager</option>
                    <option value="STAFF">Staff</option>
                  </Select>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      try {
                        await api.removeMember(activeWorkspaceId!, m.id);
                        toast.success("Member removed");
                        members.refetch();
                      } catch (err) {
                        toast.error(err instanceof ApiError ? err.message : "We couldn't remove that member.");
                      }
                    }}
                  >
                    Remove
                  </Button>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
