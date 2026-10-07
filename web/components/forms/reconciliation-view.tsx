"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { AlertCircle, ArrowLeft, CheckCircle2, ChevronRight, CircleDashed, Copy, Download, FileUp, Lightbulb } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, Sheet } from "@/components/ui/dialog";
import { Select } from "@/components/ui/field";
import { EmptyState, ErrorState, NotFoundState, Skeleton } from "@/components/ui/states";
import { refreshAll, useQuery } from "@/hooks/use-query";
import { useSingleFlight } from "@/hooks/use-single-flight";
import { api, ApiError } from "@/lib/api-client";
import { formatNaira, friendlyDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ColumnMapping, CsvPreview, ImportRow, InvoiceView, RowStatus } from "@/types/api";

const ROW_BADGE: Record<RowStatus, { label: string; cls: string; Icon: typeof CircleDashed }> = {
  SUGGESTED_MATCH: { label: "Possible match", cls: "bg-amber-wash text-amber", Icon: Lightbulb },
  MATCHED: { label: "Matched", cls: "bg-emerald-wash text-emerald-ink", Icon: CheckCircle2 },
  UNMATCHED: { label: "No match yet", cls: "bg-sunken text-ink-soft", Icon: CircleDashed },
  VALID: { label: "Money out", cls: "bg-sunken text-ink-soft", Icon: CheckCircle2 },
  INVALID: { label: "Can't read", cls: "bg-red-wash text-red", Icon: AlertCircle },
  DUPLICATE: { label: "Duplicate", cls: "bg-red-wash text-red", Icon: Copy },
};
function RowBadge({ status }: { status: RowStatus }) {
  const { label, cls, Icon } = ROW_BADGE[status];
  return <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-semibold", cls)}><Icon className="size-4" aria-hidden /> {label}</span>;
}

const NOTICE = "These rows come from a file you uploaded. SettleNG has not checked them with any bank.";

/* ---------- upload + preview ---------- */
const MAP_FIELDS: [keyof ColumnMapping, string, boolean][] = [["date", "Date", true], ["amount", "Amount", true], ["description", "Description", false], ["direction", "In or out", false], ["reference", "Reference", false]];

function UploadPanel({ onImported }: { onImported: (id: string) => void }) {
  const once = useSingleFlight();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<CsvPreview | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [busy, setBusy] = useState<"preview" | "save" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runPreview = async (f: File, m?: ColumnMapping) => {
    setBusy("preview"); setError(null);
    try { const p = await api.previewCsv(f, m); setPreview(p); setMapping(p.mapping ?? m ?? {}); }
    catch (e) { setPreview(null); setError(e instanceof ApiError ? e.message : "We couldn't read that file. Please try again."); }
    finally { setBusy(null); }
  };
  const pick = (f: File | undefined) => { if (!f) return; setFile(f); setPreview(null); setMapping({}); void runPreview(f); };
  const save = once(async () => {
    if (!file) return;
    setBusy("save");
    try { const r = await api.saveCsv(file, mapping); toast.success(`Imported ${r.rowCount} rows`); refreshAll(); onImported(r.id); }
    catch (e) { toast.error(e instanceof ApiError ? e.message : "We couldn't import this file. Please try again."); setBusy(null); }
  });
  const reset = () => { setFile(null); setPreview(null); setError(null); if (input.current) input.current.value = ""; };

  return (
    <section aria-labelledby="up-h" className="rounded-2xl border border-line bg-surface p-4 md:p-6">
      <h2 id="up-h" className="text-xl font-bold">Upload a statement</h2>
      <p className="mt-1 text-slate">A CSV file with a date, an amount and (ideally) a description for each row.</p>
      <a href={api.templateUrl()} download className="inline-flex min-h-11 items-center gap-1 font-semibold text-emerald-ink underline"><Download className="size-4" aria-hidden /> Download a sample file</a>
      <input ref={input} id="csv-file" type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} />
      {!file ? (
        <label htmlFor="csv-file" className="mt-4 flex min-h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line bg-paper px-4 text-center font-semibold hover:bg-sunken has-[:focus-visible]:outline">
          <FileUp className="size-8 text-slate" aria-hidden /> Choose a CSV file <span className="text-sm font-normal text-slate">Up to 1 MB and 500 rows</span>
        </label>
      ) : (
        <p className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-sunken px-4 py-3"><span className="font-semibold">{file.name}</span><Button variant="ghost" size="sm" onClick={reset}>Choose another</Button></p>
      )}
      {busy === "preview" && <div className="mt-4 space-y-2" aria-busy="true" aria-label="Reading your file"><Skeleton className="h-10" /><Skeleton className="h-10" /><Skeleton className="h-10" /></div>}
      {error && <div className="mt-4"><ErrorState error={new Error(error)} title="We couldn't read that file" /></div>}

      {preview && (
        <div className="mt-5 space-y-4">
          {preview.problems.length > 0 && (
            <div role="alert" className="rounded-2xl border border-amber/40 bg-amber-wash p-4">
              <p className="font-semibold text-amber">{preview.problems.join(" ")}</p>
              <p className="mt-1 text-ink-soft">Tell us which column is which:</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {MAP_FIELDS.map(([key, label, required]) => (
                  <label key={key} className="text-sm font-semibold">{label}{required ? "" : " (optional)"}
                    <Select className="mt-1" value={mapping[key] ?? ""} onChange={(e) => setMapping({ ...mapping, [key]: e.target.value || undefined })}>
                      <option value="">{required ? "Choose a column" : "None"}</option>{preview.headers.map((h) => <option key={h} value={h}>{h}</option>)}
                    </Select>
                  </label>
                ))}
              </div>
              <Button className="mt-3" size="sm" onClick={() => file && void runPreview(file, mapping)} loading={busy === "preview"}>Check again</Button>
            </div>
          )}
          {preview.rowCount > 0 && (
            <>
              <ul className="flex flex-wrap gap-2" aria-label="Summary of rows">
                {(["SUGGESTED_MATCH", "UNMATCHED", "VALID", "DUPLICATE", "INVALID"] as RowStatus[]).filter((s) => preview.counts[s] > 0).map((s) => (
                  <li key={s}><span className="inline-flex items-center gap-2"><RowBadge status={s} /><span className="font-bold tnum">{preview.counts[s]}</span></span></li>
                ))}
              </ul>
              <ul className="max-h-96 divide-y divide-line overflow-y-auto rounded-2xl border border-line">
                {preview.rows.map((r) => (
                  <li key={r.rowNumber} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
                    <span className="min-w-0 basis-full sm:basis-0 sm:flex-1"><span className="block truncate font-semibold">{r.description ?? "No description"}</span>
                      <span className="block text-sm text-slate">{r.date ? friendlyDate(r.date) : "No date"}{r.note ? ` · ${r.note}` : ""}</span></span>
                    <RowBadge status={r.status} />
                    <span className="figure tnum ml-auto text-right font-bold sm:w-28">{r.amount ? formatNaira(r.amount, { signed: r.direction === "OUT" ? "-" : "+" }) : "-"}</span>
                  </li>
                ))}
              </ul>
              <p className="text-sm text-slate">Nothing is saved yet. {NOTICE} Possible matches are only suggestions: you decide on the next screen.</p>
              <Button size="lg" disabled={!preview.canSave || preview.problems.length > 0} loading={busy === "save"} onClick={() => void save()}>
                {preview.canSave ? `Import ${preview.rowCount} rows` : "Nothing new to import"}
              </Button>
            </>
          )}
        </div>
      )}
    </section>
  );
}

/* ---------- history ---------- */
function History() {
  const router = useRouter();
  const q = useQuery(() => api.imports(), []);
  return (
    <section aria-labelledby="hist-h" className="mt-8">
      <h2 id="hist-h" className="mb-2 text-xl font-bold">Your uploads</h2>
      {q.error && !q.data ? <ErrorState error={q.error} onRetry={q.refetch} /> : !q.data ? <Skeleton className="h-32" /> : q.data.items.length === 0 ? (
        <EmptyState title="No uploads yet" body="Upload a CSV above and your matched and unmatched rows will be kept here." />
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
          {q.data.items.map((i) => {
            const pending = i.counts.SUGGESTED_MATCH ?? 0;
            return (
              <li key={i.id}>
                <button type="button" onClick={() => router.push(`/reconciliation?import=${i.id}`)} className="flex min-h-[4.5rem] w-full items-center gap-3 px-4 py-3 text-left hover:bg-sunken">
                  <span className="min-w-0 flex-1"><span className="block truncate font-bold">{i.filename}</span>
                    <span className="block text-sm text-slate">{friendlyDate(i.createdAt.slice(0, 10))} · {i.rowCount} rows · {i.counts.MATCHED ?? 0} matched</span></span>
                  <span className={cn("rounded-full px-2.5 py-1 text-sm font-semibold", pending > 0 ? "bg-amber-wash text-amber" : "bg-emerald-wash text-emerald-ink")}>{pending > 0 ? `${pending} to review` : "All reviewed"}</span>
                  <ChevronRight className="size-5 text-slate" aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/* ---------- one import ---------- */
function ChooseInvoice({ row, onPick }: { row: ImportRow; onPick: (inv: InvoiceView) => void }) {
  const q = useQuery(() => api.invoices({ pageSize: 100 }), []);
  const open = q.data?.items.filter((i) => ["UNPAID", "PARTIALLY_PAID", "OVERDUE"].includes(i.status) && Number(i.balance) >= Number(row.amount)) ?? [];
  if (q.error) return <ErrorState error={q.error} onRetry={q.refetch} />;
  if (!q.data) return <Skeleton className="h-40" />;
  if (open.length === 0) return <p className="py-4 text-slate">No open invoice has {formatNaira(row.amount)} or more still owing.</p>;
  return (
    <ul className="divide-y divide-line">
      {open.map((i) => (
        <li key={i.id}><button type="button" onClick={() => onPick(i)} className="flex min-h-16 w-full items-center gap-3 py-2 text-left hover:text-emerald-ink">
          <span className="flex-1"><span className="block font-semibold">{i.customer.name}</span><span className="block text-sm text-slate">{i.invoiceNumber} · Due {friendlyDate(i.dueDate)}</span></span>
          <span className="figure tnum font-bold">{formatNaira(i.balance)} <span className="text-sm font-normal text-slate">owing</span></span></button></li>
      ))}
    </ul>
  );
}

function ImportDetailView({ id }: { id: string }) {
  const once = useSingleFlight();
  const router = useRouter();
  const q = useQuery(() => api.importDetail(id), [id]);
  const [confirm, setConfirm] = useState<{ row: ImportRow; invoiceId?: string; label: string } | null>(null);
  const [choosing, setChoosing] = useState<ImportRow | null>(null);
  const [busy, setBusy] = useState(false);

  if (q.error?.isNotFound) return <NotFoundState what="upload" />;
  if (q.error && !q.data) return <ErrorState error={q.error} onRetry={q.refetch} />;
  if (!q.data) return <div className="space-y-2"><Skeleton className="h-10 w-64" />{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</div>;
  const d = q.data;

  const doConfirm = once(async () => {
    if (!confirm) return;
    setBusy(true);
    try { await api.confirmRow(confirm.row.id, confirm.invoiceId); toast.success("Payment recorded and matched"); refreshAll(); }
    catch (e) { toast.error(e instanceof ApiError ? e.message : "We couldn't match this row. Please try again."); }
    finally { setBusy(false); setConfirm(null); }
  });
  const reject = once(async (row: ImportRow) => {
    try { await api.rejectRow(row.id); toast.success("Suggestion dismissed"); refreshAll(); }
    catch (e) { toast.error(e instanceof ApiError ? e.message : "We couldn't do that. Please try again."); }
  });

  return (
    <div>
      <button type="button" onClick={() => router.push("/reconciliation")} className="mb-4 inline-flex min-h-11 items-center gap-1 font-semibold text-slate hover:text-ink"><ArrowLeft className="size-4" aria-hidden /> All uploads</button>
      <h1 className="text-3xl font-extrabold">{d.filename}</h1>
      <p className="mt-1 text-slate">{d.notice}</p>
      <ul className="mt-5 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
        {d.rows.map((r) => (
          <li key={r.id} className="px-4 py-3">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="min-w-0 basis-full sm:basis-0 sm:flex-1"><span className="block truncate font-semibold">{r.description ?? "No description"}</span>
                <span className="block text-sm text-slate">{r.date ? friendlyDate(r.date) : "No date"}{r.externalReference ? ` · Ref ${r.externalReference}` : ""}</span></span>
              <RowBadge status={r.status} />
              <span className={cn("figure tnum ml-auto text-right text-lg font-bold sm:w-28", r.direction === "IN" && "text-emerald-ink")}>{r.amount ? formatNaira(r.amount, { signed: r.direction === "OUT" ? "-" : "+" }) : "-"}</span>
            </div>
            {r.note && <p className="mt-1 text-sm text-slate">{r.note}</p>}
            {r.status === "SUGGESTED_MATCH" && r.suggestedInvoice && (
              <div className="mt-3 rounded-xl bg-amber-wash p-3">
                <p className="font-semibold text-ink">This might be a payment for <Link href={`/invoices/${r.suggestedInvoice.id}`} className="underline">{r.suggestedInvoice.invoiceNumber}</Link> from {r.suggestedInvoice.customer} <span className="font-normal text-ink-soft">({formatNaira(r.suggestedInvoice.balance)} still owing)</span>.</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => setConfirm({ row: r, label: r.suggestedInvoice!.invoiceNumber })}>Yes, match it</Button>
                  <Button size="sm" variant="outline" onClick={() => void reject(r)}>Not this one</Button>
                </div>
              </div>
            )}
            {r.status === "UNMATCHED" && r.direction === "IN" && <Button className="mt-2" size="sm" variant="outline" onClick={() => setChoosing(r)}>Match to an invoice</Button>}
            {r.status === "MATCHED" && r.matchedInvoice && <p className="mt-1 text-sm">Matched to <Link href={`/invoices/${r.matchedInvoice.id}`} className="font-semibold text-emerald-ink underline">{r.matchedInvoice.invoiceNumber}</Link> · {r.matchedInvoice.customer}</p>}
          </li>
        ))}
      </ul>
      <Sheet open={!!choosing} onOpenChange={(o) => !o && setChoosing(null)} title="Which invoice was it for?" description={choosing ? `Only invoices still owing ${formatNaira(choosing.amount)} or more are shown.` : undefined}>
        {choosing && <ChooseInvoice row={choosing} onPick={(inv) => { setConfirm({ row: choosing, invoiceId: inv.id, label: inv.invoiceNumber }); setChoosing(null); }} />}
      </Sheet>
      <ConfirmDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)} loading={busy} title="Record this payment?"
        description={confirm ? `This adds a ${formatNaira(confirm.row.amount)} bank-transfer payment to ${confirm.label} and counts it as money in. You are saying this row really is that payment.` : ""} confirmLabel="Yes, record it" onConfirm={() => void doConfirm()} />
    </div>
  );
}

export function ReconciliationView() {
  const router = useRouter();
  const importId = useSearchParams().get("import");
  if (importId) return <ImportDetailView id={importId} />;
  return (
    <>
      <PageHeader title="Match records" subtitle="Check a bank or POS statement against the invoices customers still owe." />
      <p className="mb-5 rounded-2xl bg-sunken px-4 py-3 text-ink-soft">{NOTICE}</p>
      <UploadPanel onImported={(id) => router.push(`/reconciliation?import=${id}`)} />
      <History />
    </>
  );
}
