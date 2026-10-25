"use client";
import { useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  ChartNoAxesCombined,
  Minus,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { useQuery } from "@/hooks/use-query";
import { api } from "@/lib/api-client";
import { formatNaira, monthShort, shortDay } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { MetricComparison, Performance, PerformancePeriod } from "@/types/api";

const PERIODS = [
  { id: "7d", label: "7 days" },
  { id: "30d", label: "30 days" },
  { id: "90d", label: "3 months" },
  { id: "6m", label: "6 months" },
  { id: "1y", label: "This year" },
] as const;

const METRICS = [
  { id: "all", label: "All" },
  { id: "sales", label: "Revenue" },
  { id: "expenses", label: "Expenses" },
  { id: "profit", label: "Profit" },
] as const;

type Metric = (typeof METRICS)[number]["id"];
type Point = Performance["points"][number];

const SALES_COLOR = "var(--emerald)";
const EXPENSES_COLOR = "var(--ink-soft)";
const PROFIT_COLOR = "var(--amber)";

const axisTick = { fill: "var(--slate)", fontSize: 12 };
const gridStroke = "var(--line)";

/** Axis labels stay short so they fit on a phone. Values are display-only; the API owns the maths. */
function compactNaira(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}₦${Math.round(abs / 100_000) / 10}m`;
  if (abs >= 1000) return `${sign}₦${Math.round(abs / 1000)}k`;
  return `${sign}₦${Math.round(abs)}`;
}

function bucketLabel(performance: Performance, point: Point): string {
  return performance.granularity === "month" ? monthShort(point.start) : shortDay(point.start);
}

function Delta({
  cmp,
  previousLabel,
}: {
  cmp: MetricComparison;
  previousLabel: string;
}) {
  const direction = cmp.direction;
  const Icon =
    direction === "UP" ? ArrowUpRight : direction === "DOWN" ? ArrowDownRight : Minus;
  const words =
    direction === "UP" ? "up" : direction === "DOWN" ? "down" : "unchanged";
  const text =
    cmp.changePct === null
      ? "No earlier data to compare"
      : direction === "FLAT"
        ? "Unchanged"
        : `${Math.abs(cmp.changePct).toFixed(1)}%`;
  return (
    <p
      className={cn(
        "mt-1 flex items-center gap-1 text-sm font-semibold",
        direction === "UP" && "text-emerald-ink",
        direction === "DOWN" && "text-red",
        direction === "FLAT" && "text-slate",
      )}
    >
      <Icon className="size-4 shrink-0" aria-hidden />
      <span className="tnum">{text}</span>
      {cmp.changePct !== null && direction !== "FLAT" && (
        <span className="sr-only"> {words} compared with {previousLabel}</span>
      )}
      <span aria-hidden className="font-normal text-slate">
        {cmp.changePct === null ? "" : `vs ${previousLabel}`}
      </span>
    </p>
  );
}

function Indicator({
  label,
  value,
  cmp,
  previousLabel,
  tone,
}: {
  label: string;
  value: string;
  cmp: MetricComparison;
  previousLabel: string;
  tone?: "profit";
}) {
  const negativeProfit = tone === "profit" && Number(value) < 0;
  return (
    <div className="rounded-2xl bg-sunken p-3 md:p-4">
      <p className="text-sm font-semibold text-slate">{label}</p>
      <p
        className={cn(
          "figure tnum mt-0.5 text-xl font-extrabold md:text-2xl",
          negativeProfit && "text-red",
        )}
      >
        <span className="sr-only">{negativeProfit ? "Loss of " : ""}</span>
        {formatNaira(value)}
      </p>
      <Delta cmp={cmp} previousLabel={previousLabel} />
    </div>
  );
}

function TrendBadge({ trend }: { trend: Performance["trend"] }) {
  const map = {
    IMPROVING: { label: "Improving", Icon: TrendingUp, className: "bg-emerald-wash text-emerald-ink" },
    DECLINING: { label: "Declining", Icon: TrendingDown, className: "bg-red-wash text-red" },
    STABLE: { label: "Stable", Icon: Minus, className: "bg-sunken text-slate" },
    UNKNOWN: { label: "Not enough history", Icon: ChartNoAxesCombined, className: "bg-sunken text-slate" },
  } as const;
  const { label, Icon, className } = map[trend];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold", className)}>
      <Icon className="size-4" aria-hidden /> {label}
    </span>
  );
}

export function PerformanceChart() {
  const [period, setPeriod] = useState<PerformancePeriod>("30d");
  const [metric, setMetric] = useState<Metric>("all");
  const q = useQuery(() => api.performance(period), [period]);
  const data = q.data;

  const chartData = useMemo(
    () =>
      (data?.points ?? []).map((p) => ({
        label: bucketLabel(data!, p),
        sales: Number(p.sales),
        expenses: Number(p.expenses),
        profit: Number(p.profit),
      })),
    [data],
  );

  const showSales = metric === "all" || metric === "sales";
  const showExpenses = metric === "all" || metric === "expenses";
  const showProfit = metric === "all" || metric === "profit";

  return (
    <section
      aria-labelledby="performance-h"
      aria-busy={q.loading || undefined}
      className="rounded-2xl border border-line bg-surface p-4 md:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="performance-h" className="text-xl font-bold">Business performance</h2>
          <p className="mt-1 text-slate">Real sales, expenses and profit from the records you entered.</p>
        </div>
        {data && <TrendBadge trend={data.trend} />}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Time period" className="flex flex-wrap rounded-xl bg-sunken p-1">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={period === p.id}
              onClick={() => setPeriod(p.id)}
              className={cn(
                "min-h-10 rounded-lg px-3 text-sm font-semibold",
                period === p.id ? "bg-surface text-ink shadow-sm" : "text-slate",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div role="group" aria-label="What to show" className="flex flex-wrap rounded-xl bg-sunken p-1">
          {METRICS.map((m) => (
            <button
              key={m.id}
              type="button"
              aria-pressed={metric === m.id}
              onClick={() => setMetric(m.id)}
              className={cn(
                "min-h-10 rounded-lg px-3 text-sm font-semibold",
                metric === m.id ? "bg-surface text-ink shadow-sm" : "text-slate",
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {q.error ? (
        <div className="mt-4">
          <ErrorState error={q.error} onRetry={q.refetch} title="We couldn't load your performance" />
        </div>
      ) : !data ? (
        <div className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
          <Skeleton className="h-64 w-full" />
        </div>
      ) : (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <Indicator label="Revenue" value={data.totals.sales} cmp={data.comparison.sales} previousLabel={data.previousLabel} />
            <Indicator label="Expenses" value={data.totals.expenses} cmp={data.comparison.expenses} previousLabel={data.previousLabel} />
            <Indicator label="Net profit" value={data.totals.profit} cmp={data.comparison.profit} previousLabel={data.previousLabel} tone="profit" />
          </div>

          {!data.hasData ? (
            <div className="mt-4">
              <EmptyState
                icon={<ChartNoAxesCombined className="size-9" />}
                title="Nothing to chart yet"
                body="Record a sale or an expense, then come back to see whether your business is growing."
              />
            </div>
          ) : (
            <>
              <div
                className="mt-4 h-64 w-full md:h-80"
                role="img"
                aria-label={`Chart of ${metric === "all" ? "revenue, expenses and profit" : metric} from ${data.from} to ${data.to}. Revenue ${formatNaira(data.totals.sales)}, expenses ${formatNaira(data.totals.expenses)}, net profit ${formatNaira(data.totals.profit)}.`}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 8, right: 4, left: -8, bottom: 0 }} barGap={2}>
                    <CartesianGrid vertical={false} stroke={gridStroke} />
                    <XAxis
                      dataKey="label"
                      tickLine={false}
                      axisLine={false}
                      tick={axisTick}
                      interval={chartData.length <= 12 ? 0 : "preserveStartEnd"}
                      minTickGap={16}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tick={axisTick}
                      tickFormatter={compactNaira}
                      width={56}
                    />
                    <Tooltip
                      cursor={{ fill: "var(--sunken)" }}
                      formatter={(value) => formatNaira(Number(value))}
                      contentStyle={{
                        borderRadius: 12,
                        border: "1px solid var(--line)",
                        background: "var(--surface)",
                        color: "var(--ink)",
                      }}
                    />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: 13 }} />
                    {showSales && (
                      <Bar dataKey="sales" name="Revenue" fill={SALES_COLOR} radius={[4, 4, 0, 0]} />
                    )}
                    {showExpenses && (
                      <Bar dataKey="expenses" name="Expenses" fill={EXPENSES_COLOR} radius={[4, 4, 0, 0]} />
                    )}
                    {showProfit && metric === "all" && (
                      <Line type="monotone" dataKey="profit" name="Profit" stroke={PROFIT_COLOR} strokeWidth={2} dot={false} />
                    )}
                    {showProfit && metric !== "all" && (
                      <Bar dataKey="profit" name="Profit" radius={[4, 4, 0, 0]}>
                        {chartData.map((d, i) => (
                          <Cell key={i} fill={d.profit < 0 ? "var(--red)" : "var(--emerald)"} />
                        ))}
                      </Bar>
                    )}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              <table className="sr-only">
                <caption>Revenue, expenses and profit per {data.granularity}</caption>
                <thead>
                  <tr>
                    <th scope="col">Period</th>
                    <th scope="col">Revenue</th>
                    <th scope="col">Expenses</th>
                    <th scope="col">Profit</th>
                  </tr>
                </thead>
                <tbody>
                  {data.points.map((p) => (
                    <tr key={p.start}>
                      <th scope="row">{bucketLabel(data, p)}</th>
                      <td>{formatNaira(p.sales)}</td>
                      <td>{formatNaira(p.expenses)}</td>
                      <td>{formatNaira(p.profit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="mt-4 rounded-2xl bg-sunken p-4">
                <h3 className="text-sm font-bold uppercase tracking-wide text-slate">What this means</h3>
                <ul className="mt-2 space-y-1.5">
                  {data.insights.map((line) => (
                    <li key={line} className="flex gap-2 text-ink-soft">
                      <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-emerald" />
                      {line}
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}
