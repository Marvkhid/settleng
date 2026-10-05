"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Archive, ArrowLeft, FilePlus2, HandCoins, Pencil, Phone, RotateCcw } from "lucide-react";
import { CustomerPaidBody } from "@/components/forms/actions";
import { CustomerSheet } from "@/components/forms/customer-form";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, Sheet } from "@/components/ui/dialog";
import { ErrorState, NotFoundState, Skeleton } from "@/components/ui/states";
import { StatusBadge } from "@/components/ui/status-badge";
import { refreshAll, useQuery } from "@/hooks/use-query";
import { api, ApiError } from "@/lib/api-client";
import { formatNaira, friendlyDate, METHOD_LABEL } from "@/lib/format";
import { cn } from "@/lib/utils";

export function CustomerDetailView() {
  const { id } = useParams<{ id: string }>();
  const q = useQuery(() => api.customer(id), [id]);
  const [editing, setEditing] = useState(false);
  const [paying, setPaying] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [busy, setBusy] = useState(false);

  if (q.error?.isNotFound) return <NotFoundState what="customer" />;
  if (q.error && !q.data) return <ErrorState error={q.error} onRetry={q.refetch} />;
  if (!q.data) return <div className="space-y-4"><Skeleton className="h-10 w-64" /><Skeleton className="h-32" /><Skeleton className="h-64" /></div>;
  const c = q.data;
  const owes = Number(c.amountOwing) > 0;

  const toggleArchive = async () => {
    setBusy(true);
    try {
      if (c.archived) await api.restoreCustomer(c.id); else await api.archiveCustomer(c.id);
      toast.success(c.archived ? "Customer restored" : "Customer archived"); refreshAll(); setArchiving(false);
    } catch (e) { toast.error(e instanceof ApiError ? e.message : "We couldn't do that. Please try again."); setArchiving(false); } finally { setBusy(false); }
  };

  return (
    <div>
      <Link href="/customers" className="mb-4 inline-flex min-h-11 items-center gap-1 font-semibold text-slate hover:text-ink"><ArrowLeft className="size-4" aria-hidden /> All customers</Link>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold md:text-4xl">{c.name}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-4 text-slate">
            {c.phone && <a href={`tel:${c.phone}`} className="inline-flex items-center gap-1 font-semibold text-ink-soft"><Phone className="size-4" aria-hidden /> {c.phone}</a>}
            {c.email && <span>{c.email}</span>}
            {c.archived && <span className="font-semibold text-amber">Archived</span>}
          </p>
          {c.notes && <p className="mt-2 max-w-xl text-ink-soft">{c.notes}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}><Pencil className="size-4" aria-hidden /> Edit</Button>
          <Button variant="outline" size="sm" onClick={() => setArchiving(true)}>{c.archived ? <><RotateCcw className="size-4" aria-hidden /> Restore</> : <><Archive className="size-4" aria-hidden /> Archive</>}</Button>
        </div>
      </div>

      <dl className="ruled grid grid-cols-3 divide-x divide-white/15 overflow-hidden rounded-3xl text-white">
        {[["Total bought", c.totalBought, false], ["Total paid", c.totalPaid, false], ["Amount owing", c.amountOwing, true]].map(([k, v, hot]) => (
          <div key={String(k)} className="px-3 py-5 md:px-8 md:py-7">
            <dt className="text-sm text-white/75">{String(k)}</dt>
            <dd className={cn("figure mt-1 text-xl font-extrabold md:text-4xl", hot && owes && "text-[#ffb4a8]")}>{formatNaira(String(v))}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-4 flex flex-wrap gap-3">
        {owes && !c.archived && <Button onClick={() => setPaying(true)}><HandCoins className="size-5" aria-hidden /> Customer paid me</Button>}
        {!c.archived && <Link href={`/invoices/new?customerId=${c.id}`} className="inline-flex h-12 items-center gap-2 rounded-xl border border-line bg-surface px-5 font-semibold hover:bg-sunken"><FilePlus2 className="size-5" aria-hidden /> New invoice</Link>}
      </div>

      <section aria-labelledby="inv-h" className="mt-8">
        <h2 id="inv-h" className="mb-2 text-xl font-bold">Invoices</h2>
        {c.invoices.length === 0 ? <p className="rounded-2xl border border-dashed border-line p-6 text-slate">No invoices yet for {c.name}.</p> : (
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
            {c.invoices.map((i) => (
              <li key={i.id}>
                <Link href={`/invoices/${i.id}`} className="flex min-h-16 flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-sunken">
                  <span className="flex-1"><span className="block font-bold">{i.invoiceNumber}</span><span className="block text-sm text-slate">Due {friendlyDate(i.dueDate)}</span></span>
                  <StatusBadge status={i.status} />
                  <span className="figure tnum w-28 text-right font-bold">{formatNaira(i.total)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="pay-h" className="mt-8">
        <h2 id="pay-h" className="mb-2 text-xl font-bold">Payments</h2>
        {c.payments.length === 0 ? <p className="rounded-2xl border border-dashed border-line p-6 text-slate">No payments recorded yet.</p> : (
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
            {c.payments.map((p) => (
              <li key={p.id} className="flex min-h-16 items-center gap-3 px-4 py-3">
                <span className="flex-1"><span className="block font-semibold">{friendlyDate(p.paymentDate)} · {METHOD_LABEL[p.method] ?? p.method}</span>
                  <Link href={`/invoices/${p.invoiceId}`} className="text-sm text-emerald-ink underline">For {p.invoiceNumber}</Link></span>
                <span className="figure tnum text-lg font-bold text-emerald-ink">{formatNaira(p.amount, { signed: "+" })}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <CustomerSheet open={editing} onOpenChange={setEditing} customer={c} />
      <Sheet open={paying} onOpenChange={setPaying} title={`${c.name} paid me`} description={`They owe ${formatNaira(c.amountOwing)}. Payments go to the oldest invoice first.`}>
        <CustomerPaidBody customerId={c.id} onDone={() => setPaying(false)} />
      </Sheet>
      <ConfirmDialog open={archiving} onOpenChange={setArchiving} loading={busy} destructive={!c.archived}
        title={c.archived ? "Restore this customer?" : "Archive this customer?"}
        description={c.archived ? `${c.name} will show up in your customer list again.` : `${c.name} will be hidden from your list. Their invoices and payments are kept.`}
        confirmLabel={c.archived ? "Restore" : "Archive"} onConfirm={toggleArchive} />
    </div>
  );
}
