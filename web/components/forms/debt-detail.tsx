"use client";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Copy, FileUp, Link2, Mail, MessageCircle, Smartphone, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { ConfirmDialog, Sheet } from "@/components/ui/dialog";
import { Field, Input, MoneyInput, Select, Textarea } from "@/components/ui/field";
import { DebtPill } from "@/components/ui/debt-pill";
import { ErrorState, NotFoundState, Skeleton } from "@/components/ui/states";
import { useAuth } from "@/components/auth/auth-provider";
import { refreshAll, useQuery } from "@/hooks/use-query";
import { api, ApiError } from "@/lib/api-client";
import { formatNaira, friendlyDate, METHOD_LABEL, todayIso } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { DebtDetail, ReminderChannel } from "@/types/api";
import { DebtReminderCard } from "@/components/ui/debt-reminder-card";

const CHANNEL_ICON: Record<ReminderChannel, typeof Mail> = {
  EMAIL: Mail,
  WHATSAPP: MessageCircle,
  SMS: Smartphone,
};

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line py-3 last:border-0">
      <dt className="text-sm font-semibold text-slate">{label}</dt>
      <dd className="text-right text-sm">{value}</dd>
    </div>
  );
}

export function DebtDetailView({ id }: { id: string }) {
  const { role } = useAuth();
  const q = useQuery(() => api.debt(id), [id]);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState<string | null>(null);

  const canManage = role === "OWNER" || role === "MANAGER";

  async function recordPayment(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    try {
      await api.recordDebtRepayment(id, {
        amount: String(form.get("amount") ?? "").trim(),
        method: (String(form.get("method") ?? "BANK_TRANSFER") as "CASH" | "BANK_TRANSFER" | "POS"),
        paidOn: String(form.get("paidOn") ?? "") || undefined,
        reference: String(form.get("reference") ?? "").trim() || undefined,
        note: String(form.get("note") ?? "").trim() || undefined,
      });
      toast.success("Payment recorded");
      setPaymentOpen(false);
      refreshAll();
      q.refetch();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "We couldn't record that payment.");
    } finally {
      setBusy(false);
    }
  }

  async function sendReminder(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const channel = String(form.get("channel") ?? "EMAIL") as ReminderChannel;
    const templateKey = String(form.get("templateKey") ?? "friendly") as "friendly" | "firm";
    setBusy(true);
    try {
      const result = await api.sendReminder(id, { channel, templateKey });
      if (result.status === "SENT") toast.success(`Reminder sent via ${result.provider}`);
      else if (result.status === "SKIPPED")
        toast.warning(`Not sent: ${result.reason ?? "this channel is not configured"}`);
      else toast.error(`The provider rejected it (${result.reason ?? "failed"}). Nothing was sent.`);
      setReminderOpen(false);
      q.refetch();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "We couldn't send that reminder.");
    } finally {
      setBusy(false);
    }
  }

  async function createLink() {
    setBusy(true);
    try {
      const created = await api.createPaymentRequest(id, 30);
      const url = `${window.location.origin}${created.path}`;
      setLink(url);
      await navigator.clipboard.writeText(url).catch(() => {});
      toast.success("Payment link created and copied");
      q.refetch();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "We couldn't create a payment link.");
    } finally {
      setBusy(false);
    }
  }

  async function upload(file: File) {
    setBusy(true);
    try {
      await api.uploadDocument(id, file);
      toast.success("Document attached");
      q.refetch();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "We couldn't attach that file.");
    } finally {
      setBusy(false);
    }
  }

  async function setOverride(override: "DISPUTED" | "WRITTEN_OFF" | null) {
    setBusy(true);
    try {
      await api.updateDebt(id, { override });
      toast.success(override ? `Marked ${override.toLowerCase().replace("_", " ")}` : "Back to automatic status");
      q.refetch();
      refreshAll();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "We couldn't update this debt.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await api.deleteDebt(id);
      toast.success("Debt deleted");
      window.location.assign("/debts");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "We couldn't delete this debt.");
      setBusy(false);
      setDeleteOpen(false);
    }
  }

  if (q.error && q.error.isNotFound) return <NotFoundState what="debt" />;
  if (q.error && !q.data) return <ErrorState error={q.error} onRetry={q.refetch} />;
  if (!q.data) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-32" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const d: DebtDetail = q.data;
  const settled = d.status === "PAID";

  return (
    <>
      <PageHeader
        title={d.counterpartyName}
        subtitle={d.description}
        actions={
          <Link href="/debts" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            <ArrowLeft className="size-4" aria-hidden /> All debts
          </Link>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <DebtPill status={d.status} daysOverdue={d.daysOverdue} />
        <span className="rounded-full bg-sunken px-2.5 py-1 text-xs font-semibold text-ink-soft">
          {d.direction === "OWED_TO_ME" ? "Owed to you" : "You owe this"}
        </span>
        {d.customer && (
          <Link href={`/customers/${d.customer.id}`} className="rounded-full bg-sunken px-2.5 py-1 text-xs font-semibold text-emerald-ink underline">
            {d.customer.name}
          </Link>
        )}
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-line bg-surface p-4">
          <p className="text-sm font-semibold text-slate">Outstanding</p>
          <p className="figure tnum mt-1 text-3xl font-extrabold">{formatNaira(d.balance)}</p>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-4">
          <p className="text-sm font-semibold text-slate">Original amount</p>
          <p className="figure tnum mt-1 text-3xl font-extrabold">{formatNaira(d.principal)}</p>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-4">
          <p className="text-sm font-semibold text-slate">Paid so far</p>
          <p className="figure tnum mt-1 text-3xl font-extrabold text-emerald-ink">{formatNaira(d.totalRepaid)}</p>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        <Button size="sm" onClick={() => setPaymentOpen(true)} disabled={settled}>
          Record payment
        </Button>
        <Button size="sm" variant="outline" onClick={() => setReminderOpen(true)} disabled={settled}>
          Send reminder
        </Button>
        <Button size="sm" variant="outline" loading={busy} onClick={() => void createLink()} disabled={settled}>
          <Link2 className="size-4" aria-hidden /> Payment link
        </Button>
        <label className={cn(buttonVariants({ variant: "outline", size: "sm" }), "cursor-pointer")}>
          <FileUp className="size-4" aria-hidden /> Attach evidence
          <input
            type="file"
            className="sr-only"
            accept="application/pdf,image/png,image/jpeg,image/webp"
            onChange={(e) => { const f = e.target.files?.[0]; e.currentTarget.value = ""; if (f) void upload(f); }}
          />
        </label>
        {canManage && d.override !== "DISPUTED" && !settled && (
          <Button size="sm" variant="ghost" onClick={() => void setOverride("DISPUTED")}>Mark disputed</Button>
        )}
        {canManage && d.override === "DISPUTED" && (
          <Button size="sm" variant="ghost" onClick={() => void setOverride(null)}>Clear dispute</Button>
        )}
        {canManage && d.override !== "WRITTEN_OFF" && (
          <Button size="sm" variant="ghost" onClick={() => void setOverride("WRITTEN_OFF")}>Write off</Button>
        )}
        {canManage && d.repaymentCount === 0 && (
          <Button size="sm" variant="ghost" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="size-4 text-red" aria-hidden /> Delete
          </Button>
        )}
      </div>

      {link && (
        <div className="mb-6 rounded-2xl border border-emerald/40 bg-emerald-wash p-4">
          <p className="text-sm font-semibold text-emerald-ink">Share this payment link</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Input readOnly value={link} aria-label="Payment link" className="min-w-0 flex-1" />
            <Button size="sm" variant="outline" onClick={() => { void navigator.clipboard.writeText(link); toast.success("Copied"); }}>
              <Copy className="size-4" aria-hidden /> Copy
            </Button>
          </div>
          <p className="mt-2 text-sm text-slate">Anyone with this link can see the balance. They cannot mark anything paid.</p>
        </div>
      )}

      <DebtReminderCard debtId={id} balance={d.balance} status={d.status} />

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-line bg-surface p-5">
          <h2 className="mb-2 text-lg font-extrabold tracking-tight">Details</h2>
          <dl>
            <Row label="Amount" value={formatNaira(d.principal)} />
            <Row label="Started" value={friendlyDate(d.incurredOn)} />
            <Row label="Due" value={d.dueOn ? friendlyDate(d.dueOn) : "No date agreed"} />
            <Row label="Phone" value={d.counterpartyPhone ?? "—"} />
            <Row label="Email" value={d.counterpartyEmail ?? "—"} />
            <Row label="Terms" value={d.terms ?? "—"} />
          </dl>
        </section>

        <section className="rounded-2xl border border-line bg-surface p-5">
          <h2 className="mb-2 text-lg font-extrabold tracking-tight">Payments</h2>
          {d.repayments.length === 0 ? (
            <p className="py-4 text-sm text-slate">Nothing paid yet. Record a payment and the balance updates immediately.</p>
          ) : (
            <ul className="divide-y divide-line">
              {d.repayments.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 py-3">
                  <span>
                    <span className="figure tnum block font-semibold text-emerald-ink">{formatNaira(r.amount)}</span>
                    <span className="block text-sm text-slate">
                      {friendlyDate(r.paidOn)} · {METHOD_LABEL[r.method] ?? r.method}
                      {r.reference ? ` · ${r.reference}` : ""}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-line bg-surface p-5">
          <h2 className="mb-2 text-lg font-extrabold tracking-tight">Reminders</h2>
          {d.reminders.length === 0 ? (
            <p className="py-4 text-sm text-slate">No reminders yet. Sending one records exactly what the provider answered.</p>
          ) : (
            <ul className="divide-y divide-line">
              {d.reminders.map((r) => {
                const Icon = CHANNEL_ICON[r.channel];
                return (
                  <li key={r.id} className="flex items-start gap-3 py-3">
                    <Icon className="mt-0.5 size-4 text-slate" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">
                        {r.channel} · {r.status.toLowerCase()}
                      </span>
                      <span className="block text-xs text-slate">
                        {friendlyDate(r.scheduledFor.slice(0, 10))}
                        {r.lastError ? ` · ${r.lastError}` : ""}
                      </span>
                    </span>
                    {r.status !== "SENT" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={async () => {
                          try {
                            const res = await api.sendExistingReminder(id, r.id);
                            toast[res.status === "SENT" ? "success" : "warning"](
                              res.status === "SENT" ? "Reminder sent" : `Not sent: ${res.reason ?? "provider not configured"}`,
                            );
                            q.refetch();
                          } catch (err) {
                            toast.error(err instanceof ApiError ? err.message : "We couldn't send it.");
                          }
                        }}
                      >
                        Try now
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-line bg-surface p-5">
          <h2 className="mb-2 text-lg font-extrabold tracking-tight">Documents</h2>
          {d.documents.length === 0 ? (
            <p className="py-4 text-sm text-slate">No evidence attached. Add an IOU, receipt or agreement (PDF or photo, up to 5 MB).</p>
          ) : (
            <ul className="divide-y divide-line">
              {d.documents.map((doc) => (
                <li key={doc.id} className="flex items-center justify-between gap-3 py-3">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{doc.filename}</span>
                    <span className="block text-xs text-slate">{Math.ceil(doc.sizeBytes / 1024)} KB</span>
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      try {
                        const res = await api.documentLink(doc.id);
                        window.open(res.url, "_blank", "noopener,noreferrer");
                      } catch (err) {
                        toast.error(err instanceof ApiError ? err.message : "We couldn't open that document.");
                      }
                    }}
                  >
                    Open
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="mt-6 rounded-2xl border border-line bg-surface p-5">
        <h2 className="mb-2 text-lg font-extrabold tracking-tight">History</h2>
        <ol className="space-y-3">
          {d.activities.map((a) => (
            <li key={a.id} className="flex gap-3 text-sm">
              <span aria-hidden className="mt-1.5 size-2 shrink-0 rounded-full bg-emerald" />
              <span>
                <span className="block">{a.summary}</span>
                <span className="block text-xs text-slate">{new Date(a.createdAt).toLocaleString("en-NG")}</span>
              </span>
            </li>
          ))}
          {d.activities.length === 0 && <li className="text-sm text-slate">No activity recorded yet.</li>}
        </ol>
      </section>

      <Sheet open={paymentOpen} onOpenChange={setPaymentOpen} title="Record a payment" description={`${formatNaira(d.balance)} outstanding`}>
        <form onSubmit={recordPayment} className="space-y-4" noValidate>
          <Field label="Amount received" htmlFor="pay-amount">
            <MoneyInput id="pay-amount" name="amount" required />
          </Field>
          <Field label="Method" htmlFor="pay-method">
            <Select id="pay-method" name="method" defaultValue="BANK_TRANSFER">
              <option value="BANK_TRANSFER">Bank transfer</option>
              <option value="CASH">Cash</option>
              <option value="POS">POS</option>
            </Select>
          </Field>
          <Field label="Date paid" htmlFor="pay-date">
            <Input id="pay-date" name="paidOn" type="date" defaultValue={todayIso()} max={todayIso()} />
          </Field>
          <Field label="Receipt reference" htmlFor="pay-ref" optional hint="Stops the same receipt being recorded twice.">
            <Input id="pay-ref" name="reference" maxLength={80} />
          </Field>
          <Field label="Note" htmlFor="pay-note" optional>
            <Textarea id="pay-note" name="note" maxLength={200} />
          </Field>
          <Button type="submit" size="lg" className="w-full" loading={busy}>Save payment</Button>
        </form>
      </Sheet>

      <Sheet open={reminderOpen} onOpenChange={setReminderOpen} title="Send a reminder" description="SettleNG reports exactly what the provider says.">
        <form onSubmit={sendReminder} className="space-y-4" noValidate>
          <Field label="Channel" htmlFor="rem-channel">
            <Select id="rem-channel" name="channel" defaultValue="EMAIL">
              <option value="EMAIL">Email</option>
              <option value="WHATSAPP">WhatsApp</option>
              <option value="SMS">SMS</option>
            </Select>
          </Field>
          <Field label="Tone" htmlFor="rem-tone">
            <Select id="rem-tone" name="templateKey" defaultValue="friendly">
              <option value="friendly">Friendly reminder</option>
              <option value="firm">Firm reminder</option>
            </Select>
          </Field>
          <p className="rounded-xl bg-sunken p-3 text-sm text-slate">
            Reminders are professional and factual. They never threaten, and they are never sent to anyone but this debtor.
          </p>
          <Button type="submit" size="lg" className="w-full" loading={busy}>Send now</Button>
        </form>
      </Sheet>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete this debt?"
        description="This removes the debt and its history. Debts with payments cannot be deleted — write them off instead."
        confirmLabel="Delete debt"
        destructive
        loading={busy}
        onConfirm={() => void remove()}
      />
    </>
  );
}
