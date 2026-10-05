"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { ArrowDownLeft, ArrowUpRight, ListChecks, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { ConfirmDialog, Sheet } from "@/components/ui/dialog";
import { Field, Input, MoneyInput, Select } from "@/components/ui/field";
import { Pager } from "@/components/ui/pager";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { useDebounced } from "@/hooks/use-debounced";
import { usePage } from "@/hooks/use-page";
import { useSingleFlight } from "@/hooks/use-single-flight";
import { refreshAll, useQuery } from "@/hooks/use-query";
import { api, ApiError } from "@/lib/api-client";
import { formatNaira, friendlyDate, METHOD_LABEL, todayIso } from "@/lib/format";
import { cleanAmount, transactionSchema, type TransactionForm } from "@/lib/schemas";
import { cn } from "@/lib/utils";
import type { TransactionView } from "@/types/api";

const SOURCE_LABEL = { MANUAL: "Added by you", INVOICE_PAYMENT: "Invoice payment", IMPORTED: "From a CSV import" } as const;
const TABS = [["", "All"], ["INCOME", "Money in"], ["EXPENSE", "Money out"]] as const;

function EditBody({ t, onDone }: { t: TransactionView; onDone: () => void }) {
  const once = useSingleFlight();
  const cats = useQuery(() => api.categories(), []);
  const list = (t.type === "INCOME" ? cats.data?.income : cats.data?.expense) ?? [];
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<TransactionForm>({
    resolver: zodResolver(transactionSchema), defaultValues: { type: t.type, amount: t.amount, category: t.category, description: t.description ?? "", date: t.date },
  });
  const submit = handleSubmit(async (v) => {
    try {
      await api.updateTransaction(t.id, { amount: cleanAmount(v.amount)!, category: v.category, description: v.description ?? "", date: v.date });
      toast.success("Record updated"); refreshAll(); onDone();
    } catch (e) { toast.error(e instanceof ApiError ? e.message : "We couldn't save the changes. Please try again."); }
  });
  return (
    <form onSubmit={once(submit)} className="space-y-4" noValidate>
      <Field label="Amount" htmlFor="e-amount" error={errors.amount?.message}><MoneyInput id="e-amount" {...register("amount")} /></Field>
      <Field label="Category" htmlFor="e-cat" error={errors.category?.message}>
        <Input id="e-cat" list="e-cats" {...register("category")} /><datalist id="e-cats">{list.map((c) => <option key={c} value={c} />)}</datalist>
      </Field>
      <Field label="Note" htmlFor="e-desc" optional error={errors.description?.message}><Input id="e-desc" {...register("description")} /></Field>
      <Field label="Date" htmlFor="e-date" error={errors.date?.message}><Input id="e-date" type="date" max={todayIso()} {...register("date")} /></Field>
      <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>{isSubmitting ? "Saving…" : "Save changes"}</Button>
    </form>
  );
}

export function TransactionsView() {
  const once = useSingleFlight();
  const params = useSearchParams();
  const router = useRouter();
  const type = (params.get("type") ?? "") as "" | "INCOME" | "EXPENSE";
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [editing, setEditing] = useState<TransactionView | null>(null);
  const [deleting, setDeleting] = useState<TransactionView | null>(null);
  const [busy, setBusy] = useState(false);
  const debounced = useDebounced(search);
  const [page, setPage] = usePage(`${type}|${debounced}|${category}|${from}|${to}`);
  const cats = useQuery(() => api.categories(), []);
  const q = useQuery(() => api.transactions({ type, search: debounced, category, from, to, page, pageSize: 20 }), [type, debounced, category, from, to, page]);
  const catList = type === "INCOME" ? cats.data?.income : type === "EXPENSE" ? cats.data?.expense : [...new Set([...(cats.data?.income ?? []), ...(cats.data?.expense ?? [])])].sort();
  const filtered = !!(debounced || category || from || to);

  const remove = once(async () => {
    if (!deleting) return;
    setBusy(true);
    try { await api.deleteTransaction(deleting.id); toast.success("Record deleted"); refreshAll(); } catch (e) { toast.error(e instanceof ApiError ? e.message : "We couldn't delete this record."); } finally { setBusy(false); setDeleting(null); }
  });

  return (
    <>
      <PageHeader title={type === "INCOME" ? "Sales and money in" : type === "EXPENSE" ? "Expenses and money out" : "All records"} subtitle="Everything you have recorded, newest first."
        actions={<Link href="/transactions/new" className={cn(buttonVariants())}><Plus className="size-5" aria-hidden /> Add record</Link>} />
      <div role="group" aria-label="Show" className="mb-3 flex rounded-xl bg-sunken p-1 sm:inline-flex">
        {TABS.map(([val, label]) => (
          <button key={val} type="button" aria-pressed={type === val} onClick={() => router.replace(val ? `/transactions?type=${val}` : "/transactions")}
            className={cn("min-h-10 flex-1 rounded-lg px-4 text-sm font-semibold", type === val ? "bg-surface shadow-sm" : "text-slate")}>{label}</button>
        ))}
      </div>
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative sm:col-span-2 lg:col-span-1">
          <Search aria-hidden className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-slate" />
          <Input type="search" aria-label="Search records" placeholder="Search" className="pl-12" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select aria-label="Category" value={category} onChange={(e) => setCategory(e.target.value)}><option value="">All categories</option>{catList?.map((c) => <option key={c} value={c}>{c}</option>)}</Select>
        <Input type="date" aria-label="From date" value={from} max={to || todayIso()} onChange={(e) => setFrom(e.target.value)} />
        <Input type="date" aria-label="To date" value={to} min={from} max={todayIso()} onChange={(e) => setTo(e.target.value)} />
      </div>

      {q.error && !q.data ? <ErrorState error={q.error} onRetry={q.refetch} /> : !q.data ? (
        <div className="space-y-2">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : q.data.items.length === 0 ? (
        filtered ? <EmptyState title="No records match" body="Try clearing a filter or searching for something else." />
          : <EmptyState icon={<ListChecks className="size-9" />} title={type === "EXPENSE" ? "No expenses yet" : type === "INCOME" ? "No sales yet" : "No records yet"}
              body={type === "EXPENSE" ? "Start recording what you spend on stock, transport, utilities and other business costs." : "Record a sale or an expense and it will appear here."}
              action={<Link href="/transactions/new" className={buttonVariants()}>Add record</Link>} />
      ) : (
        <>
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
            {q.data.items.map((t) => {
              const income = t.sign === "+";
              return (
                <li key={t.id} className="flex min-h-[4.25rem] items-center gap-3 px-4 py-3">
                  <span aria-hidden className={cn("flex size-10 shrink-0 items-center justify-center rounded-full", income ? "bg-emerald-wash text-emerald-ink" : "bg-sunken text-ink-soft")}>
                    {income ? <ArrowDownLeft className="size-5" /> : <ArrowUpRight className="size-5" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{t.description ?? t.category}</span>
                    <span className="block truncate text-sm text-slate">
                      {friendlyDate(t.date)} · {t.category}{t.customer ? ` · ${t.customer.name}` : ""}{t.paymentMethod ? ` · ${METHOD_LABEL[t.paymentMethod] ?? t.paymentMethod}` : ""}
                    </span>
                    <span className="mt-0.5 inline-block rounded-full bg-sunken px-2 py-0.5 text-xs font-semibold text-ink-soft">
                      {t.invoice ? <Link href={`/invoices/${t.invoice.id}`} className="underline">{SOURCE_LABEL[t.source]} · {t.invoice.invoiceNumber}</Link> : SOURCE_LABEL[t.source]}
                    </span>
                  </span>
                  <span className={cn("figure tnum text-lg font-bold", income ? "text-emerald-ink" : "text-ink")}><span className="sr-only">{income ? "Money in " : "Money out "}</span>{formatNaira(t.amount, { signed: t.sign })}</span>
                  {t.editable && (
                    <span className="flex">
                      <Button variant="ghost" size="icon" aria-label={`Edit ${t.description ?? t.category}`} onClick={() => setEditing(t)}><Pencil className="size-4" aria-hidden /></Button>
                      <Button variant="ghost" size="icon" aria-label={`Delete ${t.description ?? t.category}`} onClick={() => setDeleting(t)}><Trash2 className="size-4 text-red" aria-hidden /></Button>
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
          <Pager page={q.data.page} totalPages={q.data.totalPages} onPage={setPage} />
        </>
      )}
      <Sheet open={!!editing} onOpenChange={(o) => !o && setEditing(null)} title="Edit record">{editing && <EditBody t={editing} onDone={() => setEditing(null)} />}</Sheet>
      <ConfirmDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)} destructive loading={busy} title="Delete this record?"
        description={deleting ? `${deleting.description ?? deleting.category} (${formatNaira(deleting.amount)}) will be removed from your totals.` : ""} confirmLabel="Delete record" onConfirm={() => void remove()} />
    </>
  );
}
