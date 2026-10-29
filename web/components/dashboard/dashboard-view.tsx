"use client";
import Link from "next/link";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronRight,
  HandCoins,
  ListChecks,
  Plus,
  ReceiptText,
  TrendingDown,
  UserRoundSearch,
  Wallet,
} from "lucide-react";
import { useActions } from "@/components/forms/actions";
import { useAuth } from "@/components/auth/auth-provider";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { useGreeting } from "@/hooks/use-greeting";
import { useQuery } from "@/hooks/use-query";
import { api } from "@/lib/api-client";
import { formatNaira, friendlyDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ActivityItem, Dashboard } from "@/types/api";
import { PerformanceChart } from "./performance-chart";

function Hero({ d }: { d: Dashboard }) {
  const strip = [
    { label: "Expenses today", value: d.expensesToday, Icon: TrendingDown },
    { label: "Money in", value: d.moneyIn, Icon: ArrowDownLeft },
    { label: "Money out", value: d.moneyOut, Icon: ArrowUpRight },
  ];
  return (
    <section aria-labelledby="sales-today" className="panel-dark relative overflow-hidden rounded-3xl">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-emerald/25 blur-3xl"
      />
      <div className="relative px-5 pb-6 pt-6 md:px-8 md:pt-8">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="sales-today" className="text-sm font-semibold uppercase tracking-[0.12em] text-white/60">
              Sales today
            </h2>
            <p className="figure mt-2 text-[clamp(2.6rem,10vw,4.5rem)] font-extrabold leading-none text-white">
              {formatNaira(d.salesToday)}
            </p>
          </div>
          <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-white/75">
            {friendlyDate(d.today, d.today)}
          </span>
        </div>
      </div>
      <dl className="relative grid grid-cols-3 divide-x divide-white/12 border-t border-white/12 bg-black/20">
        {strip.map((s) => (
          <div key={s.label} className="px-3 py-4 md:px-8">
            <dt className="flex items-center gap-1.5 text-xs text-white/65 md:text-sm">
              <s.Icon className="size-3.5 shrink-0 md:size-4" aria-hidden /> {s.label}
            </dt>
            <dd className="figure mt-1 text-lg font-bold text-white md:text-2xl">{formatNaira(s.value)}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function QuickActions() {
  const { openSale, openExpense, openCustomerPaid } = useActions();
  const tile =
    "group flex min-h-24 flex-col items-start justify-between rounded-2xl p-4 text-left text-base font-bold transition-all duration-200";
  const quiet = "border border-line bg-surface hover:-translate-y-0.5 hover:border-emerald/35 hover:shadow-depth";
  return (
    <section aria-label="Quick actions" className="grid grid-cols-2 gap-3 md:grid-cols-5">
      <button
        type="button"
        onClick={openSale}
        className={cn(tile, "col-span-2 bg-emerald-ink text-white shadow-glow hover:bg-emerald-deep md:col-span-1")}
      >
        <Plus className="size-7" aria-hidden /> Record a sale
      </button>
      <button type="button" onClick={openExpense} className={cn(tile, quiet)}>
        <ReceiptText className="size-7 text-slate transition-colors group-hover:text-emerald-ink" aria-hidden /> Record an expense
      </button>
      <button type="button" onClick={openCustomerPaid} className={cn(tile, quiet)}>
        <HandCoins className="size-7 text-slate transition-colors group-hover:text-emerald-ink" aria-hidden /> Customer paid me
      </button>
      <Link href="/customers?owing=1" className={cn(tile, quiet)}>
        <UserRoundSearch className="size-7 text-slate transition-colors group-hover:text-emerald-ink" aria-hidden /> Who owes me?
      </Link>
      <Link href="/transactions" className={cn(tile, quiet, "col-span-2 md:col-span-1")}>
        <ListChecks className="size-7 text-slate transition-colors group-hover:text-emerald-ink" aria-hidden /> View records
      </Link>
    </section>
  );
}

function Owing({ d }: { d: Dashboard }) {
  const overdue = Number(d.overdueInvoices.count);
  return (
    <section
      aria-labelledby="owing-h"
      className="rounded-2xl border border-line bg-surface p-4 md:p-6"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id="owing-h" className="text-lg font-semibold text-slate">
          Customers owing
        </h2>
        <span className="flex size-9 items-center justify-center rounded-xl bg-clay-wash text-clay">
          <HandCoins className="size-5" aria-hidden />
        </span>
      </div>
      <p className="figure mt-1 text-4xl font-extrabold">{formatNaira(d.customersOwing.total)}</p>
      <p className="mt-1 text-slate">
        {d.customersOwing.customerCount === 0
          ? "Nobody owes you right now."
          : `${d.customersOwing.customerCount} ${d.customersOwing.customerCount === 1 ? "customer" : "customers"} across ${d.customersOwing.invoiceCount} unpaid ${d.customersOwing.invoiceCount === 1 ? "invoice" : "invoices"}.`}
      </p>
      {overdue > 0 && (
        <p className="mt-3 rounded-xl bg-red-wash px-3 py-2 font-semibold text-red">
          {overdue} overdue: {formatNaira(d.overdueInvoices.total)} is past its due date.
        </p>
      )}
      {d.topDebtors.length > 0 && (
        <ul className="mt-4 divide-y divide-line border-t border-line">
          {d.topDebtors.map((c) => (
            <li key={c.id}>
              <Link
                href={`/customers/${c.id}`}
                className="-mx-2 flex min-h-14 items-center justify-between gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-sunken hover:text-emerald-ink"
              >
                <span className="flex items-center gap-3">
                  <span
                    aria-hidden
                    className="flex size-9 items-center justify-center rounded-full bg-sunken text-sm font-bold text-ink-soft"
                  >
                    {c.name.trim().charAt(0).toUpperCase()}
                  </span>
                  <span className="font-semibold">{c.name}</span>
                </span>
                <span className="flex items-center gap-1 tnum font-bold">
                  {formatNaira(c.amountOwing)} <ChevronRight className="size-4 text-slate" aria-hidden />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Link
        href="/customers?owing=1"
        className="mt-3 inline-flex min-h-11 items-center gap-1 font-semibold text-emerald-ink underline"
      >
        See everyone who owes you <ChevronRight className="size-4" aria-hidden />
      </Link>
    </section>
  );
}

function ActivityRow({ a, today }: { a: ActivityItem; today: string }) {
  const income = a.sign === "+";
  const sub = [friendlyDate(a.date, today), a.customerName ?? a.category].filter(Boolean).join(" · ");
  const body = (
    <>
      <span
        aria-hidden
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-full",
          income ? "bg-emerald-wash text-emerald-ink" : "bg-sunken text-ink-soft",
        )}
      >
        {income ? <ArrowDownLeft className="size-5" /> : <ArrowUpRight className="size-5" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">{a.label}</span>
        <span className="block truncate text-sm text-slate">{sub}</span>
      </span>
      <span className={cn("figure tnum text-lg font-bold", income ? "text-emerald-ink" : "text-ink")}>
        <span className="sr-only">{income ? "Money in " : "Money out "}</span>
        {formatNaira(a.amount, { signed: a.sign })}
      </span>
    </>
  );
  const cls = "flex min-h-16 items-center gap-3 py-2";
  return (
    <li>
      {a.invoiceId ? (
        <Link href={`/invoices/${a.invoiceId}`} className={cn(cls, "hover:bg-sunken -mx-2 px-2 rounded-xl")}>
          {body}
        </Link>
      ) : (
        <div className={cls}>{body}</div>
      )}
    </li>
  );
}

function Activity({ d }: { d: Dashboard }) {
  const { openSale } = useActions();
  return (
    <section aria-labelledby="activity-h" className="rounded-2xl border border-line bg-surface p-4 md:p-6">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 id="activity-h" className="text-xl font-bold">
          What happened recently
        </h2>
        <Link href="/transactions" className="inline-flex min-h-11 items-center font-semibold text-emerald-ink underline">
          All records
        </Link>
      </div>
      {d.recentActivity.length === 0 ? (
        <EmptyState
          icon={<Wallet className="size-9" />}
          title="Nothing recorded yet"
          body="Record your first sale and it will show up here."
          action={
            <button
              type="button"
              onClick={openSale}
              className="min-h-12 rounded-xl bg-emerald-ink px-5 font-semibold text-white hover:bg-emerald-deep"
            >
              Record a sale
            </button>
          }
        />
      ) : (
        <ul className="divide-y divide-line">
          {d.recentActivity.map((a) => (
            <ActivityRow key={a.id} a={a} today={d.today} />
          ))}
        </ul>
      )}
    </section>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading your dashboard">
      <Skeleton className="h-56 w-full rounded-3xl" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-96 w-full" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-80" />
        <Skeleton className="h-80" />
      </div>
    </div>
  );
}

export function DashboardView() {
  const q = useQuery(() => api.dashboard(), []);
  const { firstName, businessName } = useAuth();
  const hello = useGreeting(firstName);
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-extrabold md:text-4xl">{hello}</h1>
        <p className="mt-1 text-lg text-slate">
          {businessName ? (
            <>
              Here&apos;s how <span className="font-semibold text-ink">{businessName}</span> is doing.
            </>
          ) : (
            "Here's how your business is doing."
          )}
        </p>
      </div>
      {q.error && !q.data ? (
        <ErrorState error={q.error} onRetry={q.refetch} title="We couldn't load your dashboard" />
      ) : !q.data ? (
        <DashboardSkeleton />
      ) : (
        <div className="space-y-6">
          <Hero d={q.data} />
          <QuickActions />
          <PerformanceChart />
          <div className="grid items-start gap-6 lg:grid-cols-2">
            <Owing d={q.data} />
            <Activity d={q.data} />
          </div>
        </div>
      )}
    </div>
  );
}
