"use client";
import { PageHeader } from "@/components/shell/page-header";
import { ErrorState, Skeleton } from "@/components/ui/states";
import { useQuery } from "@/hooks/use-query";
import { api } from "@/lib/api-client";
import { formatNaira, monthShort } from "@/lib/format";
import { cn } from "@/lib/utils";

function maxOf(values: string[]): number {
  return Math.max(1, ...values.map((v) => Number(v) || 0));
}

export function AnalyticsView() {
  const ageing = useQuery(() => api.debtAnalytics(), []);
  const perf = useQuery(() => api.performance("90d"), []);

  if (ageing.error && !ageing.data) return <ErrorState error={ageing.error} onRetry={ageing.refetch} />;
  if (!ageing.data) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24" />
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  const a = ageing.data;
  const bucketMax = maxOf(a.ageing.map((b) => b.amount));
  const monthMax = maxOf(a.monthlyRecovered.map((m) => m.amount));

  return (
    <>
      <PageHeader title="Analytics" subtitle="Every figure below is calculated from recorded rows, never estimated." />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-line bg-surface p-4">
          <p className="text-sm font-semibold text-slate">Outstanding receivables</p>
          <p className="figure tnum mt-1 text-3xl font-extrabold">{formatNaira(a.outstanding)}</p>
          <p className="mt-1 text-sm text-slate">{a.liveDebtCount} open debts</p>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-4">
          <p className="text-sm font-semibold text-slate">Recovered</p>
          <p className="figure tnum mt-1 text-3xl font-extrabold text-emerald-ink">{formatNaira(a.recovered)}</p>
          <p className="mt-1 text-sm text-slate">All time</p>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-4">
          <p className="text-sm font-semibold text-slate">Collection rate</p>
          <p className="figure tnum mt-1 text-3xl font-extrabold">{a.collectionRate === null ? "—" : `${a.collectionRate}%`}</p>
          <p className="mt-1 text-sm text-slate">Recovered ÷ (recovered + outstanding)</p>
        </div>
      </div>

      <section className="mb-6 rounded-2xl border border-line bg-surface p-5">
        <h2 className="mb-1 text-lg font-extrabold tracking-tight">Debt ageing</h2>
        <p className="mb-4 text-sm text-slate">How long your open receivables have been past their due date.</p>
        <ul className="space-y-3">
          {a.ageing.map((b) => (
            <li key={b.key}>
              <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                <span className="font-semibold">{b.label}</span>
                <span className="text-slate">{b.count} · {formatNaira(b.amount)}</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-sunken">
                <div
                  className={cn("h-full rounded-full", b.key === "notDue" ? "bg-emerald" : b.key === "d90plus" ? "bg-red" : "bg-amber-ink")}
                  style={{ width: `${Math.max(2, (Number(b.amount) / bucketMax) * 100)}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="mb-6 rounded-2xl border border-line bg-surface p-5">
        <h2 className="mb-1 text-lg font-extrabold tracking-tight">Recovered per month</h2>
        <p className="mb-4 text-sm text-slate">Payments received against debts, last six months.</p>
        <div className="flex items-end gap-3">
          {a.monthlyRecovered.map((m) => (
            <div key={m.month} className="flex flex-1 flex-col items-center gap-2">
              <span className="figure tnum text-xs font-semibold">{formatNaira(m.amount)}</span>
              <div className="flex h-28 w-full items-end">
                <div
                  className="w-full rounded-t-lg bg-emerald"
                  style={{ height: `${Math.max(4, (Number(m.amount) / monthMax) * 100)}%` }}
                  aria-hidden
                />
              </div>
              <span className="text-xs text-slate">{monthShort(`${m.month}-01`)}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-surface p-5">
        <h2 className="mb-1 text-lg font-extrabold tracking-tight">Business performance</h2>
        <p className="mb-3 text-sm text-slate">Sales, expenses and profit over the last 90 days.</p>
        {perf.error ? (
          <ErrorState error={perf.error} onRetry={perf.refetch} />
        ) : !perf.data ? (
          <Skeleton className="h-24" />
        ) : (
          <>
            <dl className="grid grid-cols-3 gap-3">
              <div><dt className="text-sm text-slate">Sales</dt><dd className="figure tnum text-lg font-bold">{formatNaira(perf.data.totals.sales)}</dd></div>
              <div><dt className="text-sm text-slate">Expenses</dt><dd className="figure tnum text-lg font-bold">{formatNaira(perf.data.totals.expenses)}</dd></div>
              <div><dt className="text-sm text-slate">Profit</dt><dd className="figure tnum text-lg font-bold">{formatNaira(perf.data.totals.profit)}</dd></div>
            </dl>
            {perf.data.insights.length > 0 && (
              <ul className="mt-4 space-y-2 text-sm text-ink-soft">
                {perf.data.insights.map((i) => <li key={i}>{i}</li>)}
              </ul>
            )}
          </>
        )}
      </section>
    </>
  );
}
