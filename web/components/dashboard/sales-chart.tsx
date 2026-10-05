"use client";
import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Skeleton, ErrorState } from "@/components/ui/states";
import { useQuery } from "@/hooks/use-query";
import { api } from "@/lib/api-client";
import { formatNaira, shortDay } from "@/lib/format";
import type { Series, SeriesPoint } from "@/types/api";
import { cn } from "@/lib/utils";

const PERIODS = [{ id: "7d", label: "7 days" }, { id: "30d", label: "30 days" }, { id: "90d", label: "3 months" }] as const;
type Period = (typeof PERIODS)[number]["id"];

interface Bucket { label: string; sales: number; expenses: number }

/** Display-only grouping: 3 months are shown per week so the bars stay readable. */
function bucketise(points: SeriesPoint[], period: Period): Bucket[] {
  if (period !== "90d") return points.map((p) => ({ label: shortDay(p.date), sales: Number(p.sales), expenses: Number(p.expenses) }));
  const out: Bucket[] = [];
  for (let i = 0; i < points.length; i += 7) {
    const chunk = points.slice(i, i + 7);
    out.push({
      label: shortDay(chunk[0].date),
      sales: chunk.reduce((s, p) => s + Number(p.sales), 0),
      expenses: chunk.reduce((s, p) => s + Number(p.expenses), 0),
    });
  }
  return out;
}

const compact = (n: number) => (n >= 1_000_000 ? `₦${+(n / 1_000_000).toFixed(1)}m` : n >= 1000 ? `₦${Math.round(n / 1000)}k` : `₦${n}`);

export function SalesChart({ initial }: { initial: Series }) {
  const [period, setPeriod] = useState<Period>("7d");
  const q = useQuery<Series>(() => (period === "7d" ? Promise.resolve(initial) : api.series(period)), [period, initial]);
  const series = q.data?.period === period ? q.data : undefined;
  const data = useMemo(() => (series ? bucketise(series.points, period) : []), [series, period]);
  const totals = useMemo(() => ({ sales: data.reduce((s, b) => s + b.sales, 0), expenses: data.reduce((s, b) => s + b.expenses, 0) }), [data]);

  return (
    <section aria-labelledby="chart-h" className="rounded-2xl border border-line bg-surface p-4 md:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 id="chart-h" className="text-xl font-bold">Sales vs expenses</h2>
        <div role="group" aria-label="Time period" className="flex rounded-xl bg-sunken p-1">
          {PERIODS.map((p) => (
            <button key={p.id} type="button" aria-pressed={period === p.id} onClick={() => setPeriod(p.id)}
              className={cn("min-h-10 rounded-lg px-3 text-sm font-semibold", period === p.id ? "bg-surface text-ink shadow-sm" : "text-slate")}>{p.label}</button>
          ))}
        </div>
      </div>
      {q.error ? <ErrorState error={q.error} onRetry={q.refetch} title="We couldn't load the chart" /> : !series ? <Skeleton className="h-64 w-full" /> : (
        <>
          <p className="mb-3 text-slate tnum">
            Sold <strong className="text-emerald-ink">{formatNaira(totals.sales)}</strong> and spent <strong className="text-ink">{formatNaira(totals.expenses)}</strong> in this time.
          </p>
          <div className="h-64 w-full" role="img" aria-label={`Bar chart of sales and expenses. Sales ${formatNaira(totals.sales)}, expenses ${formatNaira(totals.expenses)}.`}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 4, right: 4, left: -8, bottom: 0 }} barGap={2}>
                <CartesianGrid vertical={false} stroke="#e4e0d8" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "#5b6578", fontSize: 12 }} interval={data.length <= 14 ? 0 : "preserveStartEnd"} minTickGap={16} />
                <YAxis tickLine={false} axisLine={false} tick={{ fill: "#5b6578", fontSize: 12 }} tickFormatter={compact} width={52} />
                <Tooltip cursor={{ fill: "#f3f0e9" }} formatter={(v) => formatNaira(Number(v))} contentStyle={{ borderRadius: 12, border: "1px solid #e4e0d8" }} />
                <Legend iconType="circle" />
                <Bar dataKey="sales" name="Sales" fill="#0f9d6e" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" name="Expenses" fill="#0f1b33" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </section>
  );
}
