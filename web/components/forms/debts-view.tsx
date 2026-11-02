"use client";
import Link from "next/link";
import { useState } from "react";
import { HandCoins, Plus, Search } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { DebtPill } from "@/components/ui/debt-pill";
import { Pager } from "@/components/ui/pager";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { useDebounced } from "@/hooks/use-debounced";
import { usePage } from "@/hooks/use-page";
import { useQuery } from "@/hooks/use-query";
import { api } from "@/lib/api-client";
import { formatNaira, friendlyDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { DebtDirection, DebtStatus } from "@/types/api";

const STATUS_OPTIONS: { value: DebtStatus | ""; label: string }[] = [
  { value: "", label: "All statuses" },
  { value: "PENDING", label: "Unpaid" },
  { value: "PARTIAL", label: "Partly paid" },
  { value: "OVERDUE", label: "Overdue" },
  { value: "PAID", label: "Paid" },
  { value: "DISPUTED", label: "Disputed" },
  { value: "WRITTEN_OFF", label: "Written off" },
];

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "red" | "green" }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <p className="text-sm font-semibold text-slate">{label}</p>
      <p className={cn("figure tnum mt-1 text-2xl font-extrabold", tone === "red" ? "text-red" : tone === "green" ? "text-emerald-ink" : "text-ink")}>
        {value}
      </p>
      {hint && <p className="mt-1 text-sm text-slate">{hint}</p>}
    </div>
  );
}

export function DebtsView() {
  const [direction, setDirection] = useState<DebtDirection>("OWED_TO_ME");
  const [status, setStatus] = useState<DebtStatus | "">("");
  const [search, setSearch] = useState("");
  const debounced = useDebounced(search);
  const [page, setPage] = usePage(`${direction}|${status}|${debounced}`);

  const summary = useQuery(() => api.debtSummary(), []);
  const q = useQuery(
    () => api.debts({ direction, status, search: debounced, page, pageSize: 20 }),
    [direction, status, debounced, page],
  );

  const s = summary.data;
  const owed = direction === "I_OWE" ? s?.iOwe : s?.owedToMe;

  return (
    <>
      <PageHeader
        title="Debts and recovery"
        subtitle="Who owes you, who you owe, and what has been paid back."
        actions={
          <Link href="/debts/new" className={cn(buttonVariants())}>
            <Plus className="size-5" aria-hidden /> Add debt
          </Link>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {summary.error && !s ? (
          <div className="sm:col-span-2 lg:col-span-4"><ErrorState error={summary.error} onRetry={summary.refetch} /></div>
        ) : !s ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)
        ) : (
          <>
            <Stat
              label="Outstanding"
              value={formatNaira(direction === "I_OWE" ? s.iOwe.outstanding : s.owedToMe.outstanding)}
              hint={`${direction === "I_OWE" ? s.iOwe.count : s.owedToMe.count} open ${direction === "I_OWE" ? "debts you owe" : "debts"}`}
            />
            <Stat label="Recovered" value={formatNaira(s.owedToMe.recovered)} hint={`${formatNaira(s.recoveredThisMonth)} this month`} tone="green" />
            <Stat label="Overdue" value={formatNaira(s.overdue.amount)} hint={`${s.overdue.count} past the due date`} tone="red" />
            <Stat label="Due in 7 days" value={formatNaira(s.dueSoon.amount)} hint={`${s.dueSoon.count} coming up`} />
          </>
        )}
      </div>

      <div role="group" aria-label="Show debts" className="mb-3 flex rounded-xl bg-sunken p-1 sm:inline-flex">
        {([["OWED_TO_ME", "Owed to me"], ["I_OWE", "I owe"]] as const).map(([val, label]) => (
          <button
            key={val}
            type="button"
            aria-pressed={direction === val}
            onClick={() => { setDirection(val); setPage(1); }}
            className={cn("min-h-10 flex-1 rounded-lg px-4 text-sm font-semibold", direction === val ? "bg-surface shadow-sm" : "text-slate")}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <div className="relative">
          <Search aria-hidden className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-slate" />
          <Input type="search" aria-label="Search debts" placeholder="Search name or description" className="pl-12" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select aria-label="Status" value={status} onChange={(e) => { setStatus(e.target.value as DebtStatus | ""); setPage(1); }}>
          {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </Select>
      </div>

      {q.error && !q.data ? (
        <ErrorState error={q.error} onRetry={q.refetch} />
      ) : !q.data ? (
        <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</div>
      ) : q.data.items.length === 0 ? (
        <EmptyState
          icon={<HandCoins className="size-9" />}
          title={debounced || status ? "No debts match" : direction === "I_OWE" ? "You have not recorded money you owe" : "No debts recorded"}
          body={debounced || status ? "Try clearing the search or status filter." : "Record money you are owed, or money you owe, and SettleNG will track every repayment against it."}
          action={<Link href="/debts/new" className={buttonVariants()}>Add debt</Link>}
        />
      ) : (
        <>
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
            {q.data.items.map((d) => (
              <li key={d.id}>
                <Link href={`/debts/${d.id}`} className="flex min-h-[5rem] items-center gap-3 px-4 py-3 hover:bg-sunken">
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-semibold">{d.counterpartyName}</span>
                      <DebtPill status={d.status} daysOverdue={d.daysOverdue} />
                    </span>
                    <span className="mt-0.5 block truncate text-sm text-slate">{d.description}</span>
                    <span className="block text-sm text-slate">
                      {d.dueOn ? `Due ${friendlyDate(d.dueOn)}` : `Recorded ${friendlyDate(d.incurredOn)}`}
                      {d.totalRepaid !== "0.00" ? ` · ${formatNaira(d.totalRepaid)} paid` : ""}
                    </span>
                  </span>
                  <span className="text-right">
                    <span className="figure tnum block text-lg font-bold">{formatNaira(d.balance)}</span>
                    <span className="block text-xs text-slate">of {formatNaira(d.principal)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <Pager page={q.data.page} totalPages={q.data.totalPages} onPage={setPage} />
        </>
      )}

      {owed && direction === "I_OWE" && (
        <p className="mt-6 text-sm text-slate">
          Money you owe is tracked separately and never counted as money in.{" "}
          <Link href="/debts/new" className="font-semibold text-emerald-ink underline">Record what you owe</Link>
        </p>
      )}
    </>
  );
}
