"use client";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { ArrowLeft, Ban, HandCoins, Pencil, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChoiceGroup } from "@/components/ui/choice";
import { ConfirmDialog, Sheet } from "@/components/ui/dialog";
import { Field, Input, MoneyInput } from "@/components/ui/field";
import { ErrorState, NotFoundState, Skeleton } from "@/components/ui/states";
import { StatusBadge } from "@/components/ui/status-badge";
import { refreshAll, useQuery } from "@/hooks/use-query";
import { useSingleFlight } from "@/hooks/use-single-flight";
import { api, ApiError } from "@/lib/api-client";
import { formatNaira, friendlyDate, METHOD_LABEL, todayIso } from "@/lib/format";
import { cleanAmount, paymentSchema, type PaymentForm } from "@/lib/schemas";
import type { InvoiceView } from "@/types/api";
import { InvoiceFormView } from "./invoice-form";

function PaymentBody({ invoice, onDone }: { invoice: InvoiceView; onDone: () => void }) {
  const once = useSingleFlight();
  const { register, control, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm<PaymentForm>({
    resolver: zodResolver(paymentSchema), defaultValues: { amount: "", method: "CASH", paymentDate: todayIso(), reference: "" },
  });
  const submit = handleSubmit(async (v) => {
    try {
      await api.recordPayment(invoice.id, { amount: cleanAmount(v.amount)!, method: v.method, paymentDate: v.paymentDate, reference: v.reference || undefined });
      toast.success("Payment recorded"); refreshAll(); onDone();
    } catch (e) { toast.error(e instanceof ApiError ? e.message : "We couldn't save this payment. Please try again."); }
  });
  return (
    <form onSubmit={once(submit)} className="space-y-5" noValidate>
      <Field label="How much did they pay?" htmlFor="p-amount" error={errors.amount?.message}>
        <MoneyInput id="p-amount" autoFocus aria-invalid={!!errors.amount} {...register("amount")} />
        <button type="button" className="mt-1 text-sm font-semibold text-emerald-ink underline" onClick={() => setValue("amount", invoice.balance, { shouldValidate: true })}>Everything that&apos;s left: {formatNaira(invoice.balance)}</button>
      </Field>
      <Controller control={control} name="method" render={({ field }) => (
        <ChoiceGroup legend="How did they pay?" name="p-method" columns={3} value={field.value} onChange={field.onChange}
          options={[{ value: "CASH", label: "Cash" }, { value: "BANK_TRANSFER", label: "Transfer" }, { value: "POS", label: "POS" }]} />
      )} />
      <Field label="Date paid" htmlFor="p-date" error={errors.paymentDate?.message}><Input id="p-date" type="date" max={todayIso()} {...register("paymentDate")} /></Field>
      <Field label="Reference" htmlFor="p-ref" optional hint="A receipt or transfer number stops the same payment being saved twice."><Input id="p-ref" {...register("reference")} /></Field>
      <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>{isSubmitting ? "Saving…" : "Save payment"}</Button>
    </form>
  );
}

export function InvoiceDetailView({ edit = false }: { edit?: boolean }) {
  const once = useSingleFlight();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const q = useQuery(() => api.invoice(id), [id]);
  const [paying, setPaying] = useState(false);
  const [confirm, setConfirm] = useState<"void" | "delete" | null>(null);
  const [busy, setBusy] = useState(false);

  if (q.error?.isNotFound) return <NotFoundState what="invoice" />;
  if (q.error && !q.data) return <ErrorState error={q.error} onRetry={q.refetch} />;
  if (!q.data) return <div className="space-y-4"><Skeleton className="h-10 w-64" /><Skeleton className="h-48" /><Skeleton className="h-40" /></div>;
  const inv = q.data;

  if (edit) {
    if (inv.status === "VOID") return <ErrorState title="This invoice is void" error={new Error("A void invoice can't be edited.")} />;
    return (<><Link href={`/invoices/${inv.id}`} className="mb-4 inline-flex min-h-11 items-center gap-1 font-semibold text-slate"><ArrowLeft className="size-4" aria-hidden /> Back to {inv.invoiceNumber}</Link>
      <h1 className="mb-6 text-3xl font-extrabold">Edit {inv.invoiceNumber}</h1><InvoiceFormView invoice={inv} /></>);
  }

  const canPay = !["DRAFT", "VOID", "PAID"].includes(inv.status);
  const run = once(async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try { await fn(); toast.success(ok); refreshAll(); setConfirm(null); } catch (e) { toast.error(e instanceof ApiError ? e.message : "We couldn't do that. Please try again."); setConfirm(null); } finally { setBusy(false); }
  });

  return (
    <div>
      <Link href="/invoices" className="mb-4 inline-flex min-h-11 items-center gap-1 font-semibold text-slate hover:text-ink"><ArrowLeft className="size-4" aria-hidden /> All invoices</Link>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold md:text-4xl">{inv.invoiceNumber}</h1>
          <p className="mt-1 text-lg"><Link href={`/customers/${inv.customer.id}`} className="font-semibold text-emerald-ink underline">{inv.customer.name}</Link></p>
          <p className="text-slate">Issued {friendlyDate(inv.issueDate)} · Due {friendlyDate(inv.dueDate)}</p>
        </div>
        <StatusBadge status={inv.status} className="text-base" />
      </div>

      <dl className="ruled grid grid-cols-3 divide-x divide-white/15 overflow-hidden rounded-3xl text-white">
        {[["Total", inv.total], ["Paid", inv.amountPaid], ["Left to pay", inv.balance]].map(([k, v]) => (
          <div key={k} className="px-3 py-5 md:px-8 md:py-7"><dt className="text-sm text-white/75">{k}</dt><dd className="figure mt-1 text-xl font-extrabold md:text-4xl">{formatNaira(v)}</dd></div>
        ))}
      </dl>

      <div className="mt-4 flex flex-wrap gap-3">
        {canPay && <Button onClick={() => setPaying(true)}><HandCoins className="size-5" aria-hidden /> Record payment</Button>}
        {inv.status === "DRAFT" && <Button onClick={() => void run(() => api.issueInvoice(inv.id), "Invoice issued")} loading={busy}><Send className="size-5" aria-hidden /> Issue invoice</Button>}
        {inv.status !== "VOID" && <Link href={`/invoices/${inv.id}/edit`} className="inline-flex h-12 items-center gap-2 rounded-xl border border-line bg-surface px-5 font-semibold hover:bg-sunken"><Pencil className="size-5" aria-hidden /> Edit</Link>}
        {inv.status === "DRAFT" && <Button variant="dangerOutline" onClick={() => setConfirm("delete")}><Trash2 className="size-5" aria-hidden /> Delete draft</Button>}
        {inv.status !== "DRAFT" && inv.status !== "VOID" && inv.payments.length === 0 && <Button variant="dangerOutline" onClick={() => setConfirm("void")}><Ban className="size-5" aria-hidden /> Void</Button>}
      </div>

      <section aria-labelledby="items-h" className="mt-8">
        <h2 id="items-h" className="mb-2 text-xl font-bold">Items</h2>
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
          {inv.items.map((i) => (
            <li key={i.id} className="flex items-center gap-3 px-4 py-3">
              <span className="flex-1"><span className="block font-semibold">{i.description}</span><span className="block text-sm text-slate tnum">{i.quantity} × {formatNaira(i.unitPrice)}</span></span>
              <span className="figure tnum font-bold">{formatNaira(i.lineTotal)}</span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="pays-h" className="mt-8">
        <h2 id="pays-h" className="mb-2 text-xl font-bold">Payments</h2>
        {inv.payments.length === 0 ? <p className="rounded-2xl border border-dashed border-line p-6 text-slate">No payments yet.</p> : (
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
            {inv.payments.map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-4 py-3">
                <span className="flex-1"><span className="block font-semibold">{friendlyDate(p.paymentDate)} · {METHOD_LABEL[p.method] ?? p.method}</span>{p.reference && <span className="block text-sm text-slate">Ref {p.reference}</span>}</span>
                <span className="figure tnum font-bold text-emerald-ink">{formatNaira(p.amount, { signed: "+" })}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Sheet open={paying} onOpenChange={setPaying} title="Record payment" description={`${formatNaira(inv.balance)} is still owed on ${inv.invoiceNumber}.`}>
        <PaymentBody invoice={inv} onDone={() => setPaying(false)} />
      </Sheet>
      <ConfirmDialog open={confirm === "void"} onOpenChange={(o) => !o && setConfirm(null)} loading={busy} destructive title="Void this invoice?"
        description="It will stop counting as money owed. You can't record payments on it afterwards." confirmLabel="Void invoice" onConfirm={() => void run(() => api.voidInvoice(inv.id), "Invoice voided")} />
      <ConfirmDialog open={confirm === "delete"} onOpenChange={(o) => !o && setConfirm(null)} loading={busy} destructive title="Delete this draft?"
        description="The draft will be removed for good. Issued invoices can't be deleted, only voided." confirmLabel="Delete draft"
        onConfirm={() => void run(async () => { await api.deleteInvoice(inv.id); router.replace("/invoices"); }, "Draft deleted")} />
    </div>
  );
}
