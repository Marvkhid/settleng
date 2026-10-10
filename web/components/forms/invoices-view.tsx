"use client";
import Link from "next/link";
import { useState } from "react";
import { ChevronRight, FileText, Plus, Search } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { Pager } from "@/components/ui/pager";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { StatusBadge } from "@/components/ui/status-badge";
import { useDebounced } from "@/hooks/use-debounced";
import { usePage } from "@/hooks/use-page";
import { useQuery } from "@/hooks/use-query";
import { api } from "@/lib/api-client";
import { formatNaira, friendlyDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { InvoiceStatus } from "@/types/api";

const FILTERS: { id: InvoiceStatus | ""; label: string }[] = [
  { id: "", label: "All" }, { id: "UNPAID", label: "Unpaid" }, { id: "PARTIALLY_PAID", label: "Part paid" },
  { id: "OVERDUE", label: "Overdue" }, { id: "PAID", label: "Paid" }, { id: "DRAFT", label: "Drafts" }, { id: "VOID", label: "Void" },
];

export function InvoicesView() {
  const [status, setStatus] = useState<InvoiceStatus | "">("");
  const [search, setSearch] = useState("");
  const debounced = useDebounced(search);
  const [page, setPage] = usePage(`${status}|${debounced}`);
  const q = useQuery(() => api.invoices({ status, search: debounced, page, pageSize: 15 }), [status, debounced, page]);

  return (
    <>
      <PageHeader title="Invoices" subtitle="Bills you have sent to customers."
        actions={<Link href="/invoices/new" className={cn(buttonVariants())}><Plus className="size-5" aria-hidden /> New invoice</Link>} />
      <div className="relative mb-3">
        <Search aria-hidden className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-slate" />
        <Input type="search" aria-label="Search invoices" placeholder="Search by invoice number or customer" className="pl-12" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      <div role="group" aria-label="Filter by status" className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {FILTERS.map((f) => (
          <button key={f.id} type="button" aria-pressed={status === f.id} onClick={() => setStatus(f.id)}
            className={cn("min-h-10 shrink-0 rounded-full border px-4 text-sm font-semibold", status === f.id ? "border-panel bg-panel text-white" : "border-line bg-surface text-ink-soft hover:bg-sunken")}>{f.label}</button>
        ))}
      </div>
      {q.error && !q.data ? <ErrorState error={q.error} onRetry={q.refetch} /> : !q.data ? (
        <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</div>
      ) : q.data.items.length === 0 ? (
        status || debounced
          ? <EmptyState title="No invoices match" body="Try another filter or search." />
          : <EmptyState icon={<FileText className="size-9" />} title="No invoices yet" body="Create an invoice when a customer needs a proper bill or will pay later." action={<Link href="/invoices/new" className={buttonVariants()}>New invoice</Link>} />
      ) : (
        <>
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
            {q.data.items.map((i) => (
              <li key={i.id}>
                <Link href={`/invoices/${i.id}`} className="flex min-h-20 items-center gap-3 px-4 py-3 hover:bg-sunken">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold">{i.customer.name}</span>
                    <span className="block text-sm text-slate">{i.invoiceNumber} · Due {friendlyDate(i.dueDate)}</span>
                    <StatusBadge status={i.status} className="mt-1.5 md:hidden" />
                  </span>
                  <StatusBadge status={i.status} className="hidden md:inline-flex" />
                  <span className="text-right">
                    <span className="figure tnum block text-lg font-bold">{formatNaira(i.total)}</span>
                    {Number(i.balance) > 0 && i.status !== "DRAFT" && <span className="block text-sm text-slate">{formatNaira(i.balance)} left</span>}
                  </span>
                  <ChevronRight className="size-5 text-slate" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
          <Pager page={q.data.page} totalPages={q.data.totalPages} onPage={setPage} />
        </>
      )}
    </>
  );
}
