"use client";
import { useState } from "react";
import { Download } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { ErrorState, Skeleton } from "@/components/ui/states";
import { Input } from "@/components/ui/field";
import { useQuery } from "@/hooks/use-query";
import { getApiUrl } from "@/lib/env";
import { formatNaira, addDays, todayIso } from "@/lib/format";
import { cn } from "@/lib/utils";

interface Summary {
  range: { from: string; to: string };
  sales: { total: string; recorded: string; onInvoices: string }; expenses: { total: string };
  moneyIn: string; moneyOut: string; netRecordedMovement: string;
  customersOwing: { total: string; customerCount: number; invoiceCount: number };
  overdueInvoices: { count: number; total: string };
  expensesByCategory: { category: string; total: string; count: number }[];
  incomeByCategory: { category: string; total: string; count: number }[];
}

async function fetchSummary(from: string, to: string): Promise<Summary> {
  const res = await fetch(`${getApiUrl()}/api/reports/summary?from=${from}&to=${to}`, { cache: "no-store" });
  if (!res.ok) throw Object.assign(new Error("We couldn't load the report."), { status: res.status });
  return (await res.json()) as Summary;
}

const PRESETS = [["Last 7 days", 6], ["Last 30 days", 29], ["Last 90 days", 89]] as const;

function Bars({ title, rows }: { title: string; rows: Summary["expensesByCategory"] }) {
  const max = Math.max(...rows.map((r) => Number(r.total)), 1);
  return (
    <section aria-label={title} className="rounded-2xl border border-line bg-surface p-4 md:p-6">
      <h2 className="mb-3 text-xl font-bold">{title}</h2>
      {rows.length === 0 ? <p className="text-slate">Nothing recorded in this time.</p> : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.category}>
              <div className="flex justify-between gap-3"><span className="font-semibold">{r.category}</span><span className="figure tnum font-bold">{formatNaira(r.total)}</span></div>
              <div aria-hidden className="mt-1 h-2 rounded-full bg-sunken"><div className="h-2 rounded-full bg-ink" style={{ width: `${(Number(r.total) / max) * 100}%` }} /></div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function ReportsView() {
  const [from, setFrom] = useState(addDays(todayIso(), -29));
  const [to, setTo] = useState(todayIso());
  const valid = from <= to;
  const q = useQuery(() => (valid ? fetchSummary(from, to) : Promise.reject(new Error("The start date must be before the end date."))), [from, to]);
  const exportUrl = (type: string) => `${getApiUrl()}/api/reports/export?type=${type}&from=${from}&to=${to}`;
  const s = q.data;
  const rows: [string, string, string?][] = s ? [
    ["Sales", s.sales.total, `${formatNaira(s.sales.recorded)} recorded + ${formatNaira(s.sales.onInvoices)} on invoices`],
    ["Money spent", s.expenses.total], ["Money in", s.moneyIn], ["Money out", s.moneyOut],
    ["Money in & out, net", s.netRecordedMovement, "Money in minus money out, from your records"],
    ["Money customers owe", s.customersOwing.total, `${s.customersOwing.customerCount} customers, as of today`],
    ["Overdue invoices", s.overdueInvoices.total, `${s.overdueInvoices.count} past their due date`],
  ] : [];

  return (
    <>
      <PageHeader title="Business summary" subtitle="Worked out from the records you entered." />
      <div className="mb-5 flex flex-wrap items-end gap-3">
        <div role="group" aria-label="Quick ranges" className="flex rounded-xl bg-sunken p-1">
          {PRESETS.map(([label, back]) => {
            const active = from === addDays(todayIso(), -back) && to === todayIso();
            return <button key={label} type="button" aria-pressed={active} onClick={() => { setFrom(addDays(todayIso(), -back)); setTo(todayIso()); }}
              className={cn("min-h-10 rounded-lg px-3 text-sm font-semibold", active ? "bg-surface shadow-sm" : "text-slate")}>{label}</button>;
          })}
        </div>
        <label className="text-sm font-semibold">From<Input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="mt-1" /></label>
        <label className="text-sm font-semibold">To<Input type="date" value={to} min={from} max={todayIso()} onChange={(e) => setTo(e.target.value)} className="mt-1" /></label>
      </div>
      {q.error ? <ErrorState error={q.error} onRetry={q.refetch} /> : !s ? <Skeleton className="h-96" /> : (
        <div className="space-y-6">
          <dl className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
            {rows.map(([k, v, note]) => (
              <div key={k} className="flex flex-wrap items-baseline justify-between gap-x-4 px-4 py-4 md:px-6">
                <div><dt className="font-semibold">{k}</dt>{note && <dd className="text-sm text-slate">{note}</dd>}</div>
                <dd className="figure tnum text-2xl font-extrabold">{formatNaira(v)}</dd>
              </div>
            ))}
          </dl>
          <div className="grid gap-6 lg:grid-cols-2"><Bars title="Where the money went" rows={s.expensesByCategory} /><Bars title="Where the money came from" rows={s.incomeByCategory} /></div>
          <section aria-labelledby="dl-h" className="rounded-2xl border border-line bg-surface p-4 md:p-6">
            <h2 id="dl-h" className="mb-3 text-xl font-bold">Download</h2>
            <div className="flex flex-wrap gap-3">
              {[["transactions", "All records"], ["invoices", "Invoices"], ["customers-owing", "Who owes me"]].map(([t, label]) => (
                <a key={t} href={exportUrl(t)} download className="inline-flex h-12 items-center gap-2 rounded-xl border border-line bg-surface px-5 font-semibold hover:bg-sunken"><Download className="size-5" aria-hidden /> {label} (CSV)</a>
              ))}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
