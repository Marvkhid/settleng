"use client";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useState } from "react";
import { ChevronRight, Plus, Search, Users } from "lucide-react";
import { CustomerSheet } from "@/components/forms/customer-form";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { Pager } from "@/components/ui/pager";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { useDebounced } from "@/hooks/use-debounced";
import { usePage } from "@/hooks/use-page";
import { useQuery } from "@/hooks/use-query";
import { api } from "@/lib/api-client";
import { formatNaira } from "@/lib/format";
import { cn } from "@/lib/utils";

export function CustomersView() {
  const params = useSearchParams();
  const router = useRouter();
  const owingOnly = params.get("owing") === "1";
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);
  const debounced = useDebounced(search);
  const [page, setPage] = usePage(`${debounced}|${owingOnly}`);
  const q = useQuery(() => api.customers({ search: debounced, owingOnly, page, pageSize: 20 }), [debounced, owingOnly, page]);

  return (
    <>
      <PageHeader title={owingOnly ? "Who owes me" : "Customers"} subtitle={owingOnly ? "Customers with money still to pay." : "Everyone you sell to."}
        actions={<Button onClick={() => setAdding(true)}><Plus className="size-5" aria-hidden /> Add customer</Button>} />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search aria-hidden className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-slate" />
          <Input type="search" aria-label="Search customers" placeholder="Search by name or phone" className="pl-12" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div role="group" aria-label="Filter" className="flex rounded-xl bg-sunken p-1">
          {[["All customers", false], ["Owing", true]].map(([label, val]) => (
            <button key={String(label)} type="button" aria-pressed={owingOnly === val} onClick={() => router.replace(val ? "/customers?owing=1" : "/customers")}
              className={cn("min-h-10 flex-1 rounded-lg px-4 text-sm font-semibold", owingOnly === val ? "bg-surface shadow-sm" : "text-slate")}>{String(label)}</button>
          ))}
        </div>
      </div>

      {q.error && !q.data ? <ErrorState error={q.error} onRetry={q.refetch} /> : !q.data ? (
        <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : q.data.items.length === 0 ? (
        debounced || owingOnly
          ? <EmptyState title={owingOnly && !debounced ? "Nobody owes you" : "No customers found"} body={owingOnly && !debounced ? "When you record a sale on credit, the customer will show up here." : "Try a different name or phone number."} />
          : <EmptyState icon={<Users className="size-9" />} title="No customers yet" body="Add the people you sell to so you can see what each one owes." action={<Button onClick={() => setAdding(true)}>Add customer</Button>} />
      ) : (
        <>
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
            {q.data.items.map((c) => {
              const owes = Number(c.amountOwing) > 0;
              return (
                <li key={c.id}>
                  <Link href={`/customers/${c.id}`} className="flex min-h-[4.5rem] items-center gap-3 px-4 py-3 hover:bg-sunken">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-lg font-bold">{c.name}</span>
                      <span className="block truncate text-sm text-slate">{c.phone ?? "No phone saved"}{c.archived ? " · Archived" : ""}</span>
                    </span>
                    <span className="text-right">
                      <span className={cn("figure tnum block text-xl font-bold", owes && "text-red")}>{owes ? formatNaira(c.amountOwing) : "Settled"}</span>
                      {owes && <span className="block text-sm text-slate">owes you</span>}
                    </span>
                    <ChevronRight className="size-5 text-slate" aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ul>
          <Pager page={q.data.page} totalPages={q.data.totalPages} onPage={setPage} />
        </>
      )}
      <CustomerSheet open={adding} onOpenChange={setAdding} onSaved={(c) => router.push(`/customers/${c.id}`)} />
    </>
  );
}
