"use client";
import { useState } from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { Sheet } from "@/components/ui/dialog";
import { api, ApiError } from "@/lib/api-client";
import { cn } from "@/lib/utils";

/** Switches between the user's workspaces and creates new personal or business ones. */
export function WorkspaceSwitcher({ compact = false }: { compact?: boolean }) {
  const { workspaces, activeWorkspaceId, switchWorkspace, refresh, role, me } = useAuth();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"BUSINESS" | "PERSONAL">("BUSINESS");
  const [saving, setSaving] = useState(false);

  const active = workspaces.find((w) => w.id === activeWorkspaceId);

  async function create() {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Give the workspace a name.");
      return;
    }
    setSaving(true);
    try {
      const created = await api.createWorkspace({ name: trimmed, kind });
      toast.success(`${created.name} is ready`);
      setName("");
      setCreating(false);
      setOpen(false);
      refresh();
      switchWorkspace(created.id);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "We couldn't create that workspace.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Switch workspace"
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-xl border border-line bg-surface px-3 text-left",
          compact ? "min-h-14" : "min-h-11",
        )}
      >
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold">{active?.name ?? "Workspace"}</span>
          <span className="block truncate text-xs text-slate">
            {active?.kind === "PERSONAL" ? "Personal" : "Business"} · {role ?? "member"}
          </span>
        </span>
        <ChevronsUpDown className="size-4 shrink-0 text-slate" aria-hidden />
      </button>

      <Sheet open={open} onOpenChange={setOpen} title="Your workspaces" description="Switch, or start a new one.">
        <div className="grid gap-1">
          {workspaces.map((w) => (
            <button
              key={w.id}
              type="button"
              onClick={() => { switchWorkspace(w.id); setOpen(false); }}
              className={cn(
                "flex min-h-14 items-center justify-between gap-3 rounded-xl px-3 text-left hover:bg-sunken",
                w.id === activeWorkspaceId && "bg-sunken",
              )}
            >
              <span>
                <span className="block font-semibold">{w.name}</span>
                <span className="block text-sm text-slate">
                  {w.kind === "PERSONAL" ? "Personal" : "Business"} · {w.role.toLowerCase()}
                </span>
              </span>
              {w.id === activeWorkspaceId && <Check className="size-5 text-emerald-ink" aria-hidden />}
            </button>
          ))}
          {workspaces.length === 0 && (
            <p className="py-4 text-sm text-slate">
              You are signed in as {me?.email ?? "this account"} but have no workspace yet.
            </p>
          )}
        </div>

        <div className="mt-4 border-t border-line pt-4">
          {creating ? (
            <div className="space-y-3">
              <label className="block text-sm font-semibold" htmlFor="new-workspace-name">
                Workspace name
                <Input
                  id="new-workspace-name"
                  className="mt-1"
                  value={name}
                  maxLength={120}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={kind === "PERSONAL" ? "My money" : "Marvel Fabrics"}
                />
              </label>
              <div role="group" aria-label="Workspace type" className="flex rounded-xl bg-sunken p-1">
                {(["BUSINESS", "PERSONAL"] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    aria-pressed={kind === k}
                    onClick={() => setKind(k)}
                    className={cn(
                      "min-h-10 flex-1 rounded-lg px-3 text-sm font-semibold",
                      kind === k ? "bg-surface shadow-sm" : "text-slate",
                    )}
                  >
                    {k === "BUSINESS" ? "Business" : "Personal"}
                  </button>
                ))}
              </div>
              <p className="text-sm text-slate">
                {kind === "BUSINESS"
                  ? "Customers, invoices and debts for a business."
                  : "Personal debts and money you are owed. No customers or invoices."}
              </p>
              <div className="flex gap-2">
                <Button size="sm" loading={saving} onClick={() => void create()}>Create</Button>
                <Button size="sm" variant="ghost" onClick={() => setCreating(false)}>Cancel</Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" size="sm" className="w-full" onClick={() => setCreating(true)}>
              <Plus className="size-4" aria-hidden /> New workspace
            </Button>
          )}
        </div>
      </Sheet>
    </>
  );
}
