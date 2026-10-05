"use client";
import { useState } from "react";
import { toast } from "sonner";
import { RotateCcw } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { ErrorState, Skeleton } from "@/components/ui/states";
import { refreshAll, useQuery } from "@/hooks/use-query";
import { useSingleFlight } from "@/hooks/use-single-flight";
import { api, ApiError } from "@/lib/api-client";

export function SettingsView() {
  const once = useSingleFlight();
  const q = useQuery(() => api.workspace(), []);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const reset = once(async () => {
    setBusy(true);
    try { await api.resetDemo(); toast.success("Demo reset"); refreshAll(); setOpen(false); }
    catch (e) { toast.error(e instanceof ApiError ? e.message : "We couldn't reset the demo. Please try again."); setOpen(false); }
    finally { setBusy(false); }
  });
  return (
    <>
      <PageHeader title="Settings" />
      {q.error ? <ErrorState error={q.error} onRetry={q.refetch} /> : !q.data ? <Skeleton className="h-48" /> : (
        <div className="max-w-2xl space-y-6">
          <dl className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
            {[["Business name", q.data.business?.name ?? "Not set up"], ["Currency", q.data.business?.currency === "NGN" ? "Nigerian naira (₦)" : (q.data.business?.currency ?? "-")], ["Demo mode", q.data.demoMode ? "On" : "Off"]].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 px-4 py-4"><dt className="font-semibold">{k}</dt><dd className="text-ink-soft">{v}</dd></div>
            ))}
          </dl>
          <p className="rounded-2xl bg-amber-wash p-4 text-amber">{q.data.notice} SettleNG does not connect to banks or move money.</p>
          {q.data.demoMode && (
            <section aria-labelledby="reset-h" className="rounded-2xl border border-line bg-surface p-4 md:p-6">
              <h2 id="reset-h" className="text-xl font-bold">Reset demo</h2>
              <p className="mt-1 text-slate">Put the sample business back the way it started. Your changes in this demo will be removed.</p>
              <Button variant="dangerOutline" className="mt-4" onClick={() => setOpen(true)}><RotateCcw className="size-5" aria-hidden /> Reset Demo</Button>
            </section>
          )}
        </div>
      )}
      <ConfirmDialog open={open} onOpenChange={setOpen} loading={busy} destructive title="Reset your demo?"
        description="This will restore the original sample business data and remove changes made during this demo." confirmLabel="Reset demo" onConfirm={() => void reset()} />
    </>
  );
}
