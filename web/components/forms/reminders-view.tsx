"use client";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Bell, BellOff, ChevronRight, Mail, Pause } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { useQuery } from "@/hooks/use-query";
import { api, ApiError } from "@/lib/api-client";
import { formatNaira, friendlyDate } from "@/lib/format";
import { cn } from "@/lib/utils";

const label = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${suffix}`;
};

export function RemindersView() {
  const q = useQuery(() => api.remindersOverview(), []);
  const [busy, setBusy] = useState(false);

  async function sendTest() {
    setBusy(true);
    try {
      const res = await api.sendReminderTest();
      if (res.status === "SENT") toast.success(`Test email sent to ${res.to}`);
      else toast.warning(`Not sent: ${res.reason ?? "email is not configured"}`);
      q.refetch();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "We couldn't send the test email.");
    } finally {
      setBusy(false);
    }
  }

  if (q.error && !q.data) return <ErrorState error={q.error} onRetry={q.refetch} />;
  if (!q.data) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24" />
        <Skeleton className="h-48" />
        <Skeleton className="h-40" />
      </div>
    );
  }
  const d = q.data;

  return (
    <>
      <PageHeader
        title="Smart debt reminders"
        subtitle="We email you when someone still owes you money — even when you are not signed in."
        actions={
          <Button size="sm" variant="outline" loading={busy} onClick={() => void sendTest()}>
            <Mail className="size-4" aria-hidden /> Send a test email
          </Button>
        }
      />

      {!d.emailConfigured && (
        <p className="mb-4 rounded-2xl bg-amber-wash px-4 py-3 text-sm font-semibold text-amber">
          Email delivery is not configured on this deployment yet, so scheduled emails are recorded as skipped
          instead of being sent. Ask the administrator to set the email provider key.
        </p>
      )}

      <div className="mb-6 grid gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-line bg-surface p-4">
          <p className="text-sm font-semibold text-slate">Reminders on</p>
          <p className="figure tnum mt-1 text-3xl font-extrabold">{d.totals.enabled}</p>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-4">
          <p className="text-sm font-semibold text-slate">Active now</p>
          <p className="figure tnum mt-1 text-3xl font-extrabold text-emerald-ink">{d.totals.active}</p>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-4">
          <p className="text-sm font-semibold text-slate">Paused</p>
          <p className="figure tnum mt-1 text-3xl font-extrabold">{d.totals.paused}</p>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-4">
          <p className="text-sm font-semibold text-slate">Outstanding</p>
          <p className="figure tnum mt-1 text-3xl font-extrabold">{formatNaira(d.totals.outstanding)}</p>
        </div>
      </div>

      <section className="mb-6 rounded-2xl border border-line bg-surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-extrabold tracking-tight">Debts with automatic reminders</h2>
          <p className="text-sm text-slate">
            Sent to <span className="font-semibold text-ink">{d.email ?? "your account email"}</span>
            {d.totals.nextRunAt ? ` · next ${friendlyDate(d.totals.nextRunAt.slice(0, 10))}` : ""}
          </p>
        </div>
        {d.items.length === 0 ? (
          <div className="mt-3">
            <EmptyState
              icon={<Bell className="size-9" />}
              title="No automatic reminders yet"
              body="Open any unpaid debt and turn on Smart email reminders. You choose the times; we send the email."
              action={
                <Link href="/debts" className="min-h-12 rounded-xl bg-emerald-ink px-5 py-3 font-semibold text-white hover:bg-emerald-deep">
                  Go to debts
                </Link>
              }
            />
          </div>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {d.items.map((i) => (
              <li key={i.debtId}>
                <Link href={`/debts/${i.debtId}`} className="-mx-2 flex min-h-16 flex-wrap items-center gap-3 rounded-xl px-2 py-3 hover:bg-sunken">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold">{i.name}</span>
                    <span className="block truncate text-sm text-slate">
                      {i.times.map(label).join(", ")} · {i.timezone.replace("_", " ")}
                      {i.lastError ? ` · ${i.lastError}` : ""}
                    </span>
                  </span>
                  <span className="figure tnum font-bold">{formatNaira(i.balance)}</span>
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-1 text-sm font-semibold",
                      !i.enabled
                        ? "bg-sunken text-ink-soft"
                        : i.paused
                          ? "bg-amber-wash text-amber"
                          : i.active
                            ? "bg-emerald-wash text-emerald-ink"
                            : "bg-sunken text-ink-soft",
                    )}
                  >
                    {!i.enabled ? (
                      <span className="inline-flex items-center gap-1"><BellOff className="size-3.5" aria-hidden /> Off</span>
                    ) : i.paused ? (
                      <span className="inline-flex items-center gap-1"><Pause className="size-3.5" aria-hidden /> Paused</span>
                    ) : i.active ? (
                      "On"
                    ) : (
                      "Settled"
                    )}
                  </span>
                  <ChevronRight className="size-5 text-slate" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-line bg-surface p-5">
        <h2 className="mb-1 text-lg font-extrabold tracking-tight">Recent reminder emails</h2>
        <p className="mb-3 text-sm text-slate">Exactly what was sent, and what the email provider answered.</p>
        {d.history.length === 0 ? (
          <p className="py-3 text-sm text-slate">No reminder emails yet.</p>
        ) : (
          <ul className="divide-y divide-line">
            {d.history.map((h) => (
              <li key={h.id} className="flex flex-wrap items-center gap-3 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{h.subject || "(no subject)"}</span>
                  <span className="block text-xs text-slate">
                    {new Date(h.createdAt).toLocaleString("en-NG")} · {h.debtCount} debt{h.debtCount === 1 ? "" : "s"} ·{" "}
                    {formatNaira(h.totalOutstanding)}
                  </span>
                </span>
                <span
                  className={cn(
                    "rounded-full px-2.5 py-1 text-sm font-semibold",
                    h.status === "SENT" ? "bg-emerald-wash text-emerald-ink" : h.status === "FAILED" ? "bg-red-wash text-red" : "bg-sunken text-ink-soft",
                  )}
                >
                  {h.status === "SENT" ? "Sent" : h.status === "FAILED" ? "Failed" : "Skipped"}
                </span>
                {h.errorCode && <span className="text-xs text-slate">{h.errorCode}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
