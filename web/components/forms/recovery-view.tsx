"use client";
import Link from "next/link";
import { AlertTriangle, Mail, MessageCircle, Smartphone } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { useQuery } from "@/hooks/use-query";
import { api } from "@/lib/api-client";
import { friendlyDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { NotificationEntry } from "@/types/api";

const ICON = { EMAIL: Mail, WHATSAPP: MessageCircle, SMS: Smartphone } as const;

function ChannelCard({ label, ok, detail }: { label: string; ok: boolean; detail: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="font-semibold">{label}</p>
        <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", ok ? "bg-emerald-wash text-emerald-ink" : "bg-sunken text-slate")}>
          {ok ? "Ready" : "Not configured"}
        </span>
      </div>
      <p className="mt-1 text-sm text-slate">{detail}</p>
    </div>
  );
}

function statusStyle(status: NotificationEntry["status"]) {
  if (status === "SENT") return "bg-emerald-wash text-emerald-ink";
  if (status === "FAILED") return "bg-red-wash text-red";
  return "bg-sunken text-ink-soft";
}

export function RecoveryView() {
  const q = useQuery(() => api.notificationLog(), []);
  const upcoming = useQuery(() => api.upcomingReminders(), []);

  return (
    <>
      <PageHeader
        title="Recovery"
        subtitle="Reminders, payment links and exactly what was delivered."
        actions={<Link href="/debts" className={cn(buttonVariants({ variant: "outline" }))}>Go to debts</Link>}
      />

      {q.error && !q.data ? (
        <ErrorState error={q.error} onRetry={q.refetch} />
      ) : !q.data ? (
        <div className="grid gap-3 sm:grid-cols-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
      ) : (
        <div className="mb-6 grid gap-3 sm:grid-cols-3">
          <ChannelCard label="Email" ok={q.data.configured.email} detail={q.data.configured.email ? "Resend is connected." : "Set RESEND_API_KEY on the API to send email reminders."} />
          <ChannelCard label="WhatsApp" ok={q.data.configured.whatsapp} detail={q.data.configured.whatsapp ? "Cloud API connected." : "Needs an approved template and WHATSAPP_TOKEN."} />
          <ChannelCard label="SMS" ok={q.data.configured.sms} detail={q.data.configured.sms ? "Termii is connected." : "Set TERMII_API_KEY to send SMS."} />
        </div>
      )}

      {!q.data?.configured.scheduler && q.data && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-amber-wash bg-amber-wash/50 p-4 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-ink" aria-hidden />
          <p className="text-ink-soft">
            Scheduled reminders need an external trigger (Render&apos;s free tier has no cron). Set{" "}
            <code className="rounded bg-surface px-1">CRON_SECRET</code> and point a scheduler at{" "}
            <code className="rounded bg-surface px-1">POST /api/internal/reminders/dispatch</code>. Sending a reminder by hand works today.
          </p>
        </div>
      )}

      <section className="mb-6 rounded-2xl border border-line bg-surface p-5">
        <h2 className="mb-1 text-lg font-extrabold tracking-tight">Scheduled and unsent</h2>
        <p className="mb-3 text-sm text-slate">Reminders that are due, failed, or were skipped because a channel is not configured.</p>
        {upcoming.error ? (
          <ErrorState error={upcoming.error} onRetry={upcoming.refetch} />
        ) : !upcoming.data ? (
          <Skeleton className="h-24" />
        ) : upcoming.data.items.length === 0 ? (
          <p className="py-3 text-sm text-slate">Nothing queued. Open a debt and send a reminder to start.</p>
        ) : (
          <ul className="divide-y divide-line">
            {upcoming.data.items.map((r) => {
              const Icon = ICON[r.channel];
              return (
                <li key={r.id} className="flex items-center gap-3 py-3">
                  <Icon className="size-4 shrink-0 text-slate" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <Link href={`/debts/${r.debtId}`} className="block truncate font-semibold underline">
                      {r.debtor}
                    </Link>
                    <span className="block text-sm text-slate">
                      {r.channel} · {friendlyDate(r.scheduledFor.slice(0, 10))} · {r.status.toLowerCase()}
                      {r.lastError ? ` · ${r.lastError}` : ""}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-line bg-surface p-5">
        <h2 className="mb-1 text-lg font-extrabold tracking-tight">Delivery log</h2>
        <p className="mb-3 text-sm text-slate">An append-only record of what each provider answered. Nothing here is simulated.</p>
        {q.error ? (
          <ErrorState error={q.error} onRetry={q.refetch} />
        ) : !q.data ? (
          <Skeleton className="h-32" />
        ) : q.data.items.length === 0 ? (
          <EmptyState title="Nothing sent yet" body="When you send a reminder, the provider's answer appears here — including when no provider is configured." />
        ) : (
          <ul className="divide-y divide-line">
            {q.data.items.map((n) => {
              const Icon = ICON[n.channel as keyof typeof ICON] ?? Mail;
              return (
                <li key={n.id} className="flex items-center gap-3 py-3">
                  <Icon className="size-4 shrink-0 text-slate" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <Link href={`/debts/${n.debtId}`} className="block truncate text-sm font-semibold underline">{n.debtor}</Link>
                    <span className="block text-xs text-slate">
                      {n.provider} · {new Date(n.createdAt).toLocaleString("en-NG")}
                      {n.errorCode ? ` · ${n.errorCode}` : ""}
                      {n.providerMessageId ? ` · id ${n.providerMessageId}` : ""}
                    </span>
                  </span>
                  <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", statusStyle(n.status))}>
                    {n.status.toLowerCase()}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
