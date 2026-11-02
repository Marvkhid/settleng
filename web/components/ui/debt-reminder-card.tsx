"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Bell, BellOff, Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/states";
import { api, ApiError } from "@/lib/api-client";
import { friendlyDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { DebtReminderState, ReminderFrequency } from "@/types/api";

const PRESETS = ["08:00", "13:00", "18:00"];
const label = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${suffix}`;
};

/**
 * Automatic email reminders for one debt. The email goes to the account owner, never to the debtor,
 * so the copy is explicit about who receives it.
 */
export function DebtReminderCard({ debtId, balance, status }: { debtId: string; balance: string; status: string }) {
  const [state, setState] = useState<DebtReminderState | null>(null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [frequency, setFrequency] = useState<ReminderFrequency>("THREE_TIMES_DAILY");
  const [times, setTimes] = useState<string[]>(PRESETS);

  const load = async () => {
    try {
      const res = await api.debtReminder(debtId);
      setState(res);
      if (res.reminder) {
        setFrequency(res.reminder.frequency);
        setTimes(res.reminder.times.length ? res.reminder.times : PRESETS);
      }
    } catch {
      setState({ debtId, balance, status, reminder: null });
    }
  };
  useEffect(() => { void load(); }, [debtId]);

  const settled = status === "PAID" || Number(balance) <= 0;

  async function turnOn() {
    setBusy(true);
    try {
      await api.saveDebtReminder(debtId, { enabled: true, frequency, times, timezone: "Africa/Lagos" });
      toast.success("Automatic reminders on");
      await load();
      setEditing(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "We couldn't save that.");
    } finally {
      setBusy(false);
    }
  }

  async function run(fn: () => Promise<unknown>, message: string) {
    setBusy(true);
    try {
      await fn();
      toast.success(message);
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "We couldn't do that.");
    } finally {
      setBusy(false);
    }
  }

  if (!state) return <Skeleton className="mb-6 h-28" />;
  const r = state.reminder;

  return (
    <section aria-labelledby="reminder-h" className="mb-6 rounded-2xl border border-line bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="reminder-h" className="flex items-center gap-2 text-lg font-extrabold tracking-tight">
            <Bell className="size-5 text-emerald-ink" aria-hidden /> Smart email reminders
          </h2>
          <p className="mt-1 text-sm text-slate">
            We email you — never the debtor — so you remember to follow up.
          </p>
        </div>
        {r?.enabled ? (
          <span className={cn("rounded-full px-2.5 py-1 text-sm font-semibold", r.paused ? "bg-amber-wash text-amber" : "bg-emerald-wash text-emerald-ink")}>
            {r.paused ? "Paused" : "On"}
          </span>
        ) : (
          <span className="rounded-full bg-sunken px-2.5 py-1 text-sm font-semibold text-ink-soft">Off</span>
        )}
      </div>

      {settled ? (
        <p className="mt-3 rounded-xl bg-sunken px-3 py-2 text-sm text-ink-soft">
          This debt is settled, so reminders are stopped automatically.
        </p>
      ) : r?.enabled ? (
        <div className="mt-3 space-y-3">
          <p className="text-sm">
            <span className="font-semibold">{r.times.map(label).join(", ")}</span>{" "}
            <span className="text-slate">· {r.timezone.replace("_", " ")}</span>
          </p>
          <p className="text-sm text-slate">
            {r.paused
              ? "Paused until you resume."
              : r.nextRunAt
                ? `Next email ${friendlyDate(r.nextRunAt.slice(0, 10))} at ${label(r.times[0] ?? "08:00")}.`
                : "Waiting for the next scheduled check."}
            {r.lastSentAt ? ` Last sent ${friendlyDate(r.lastSentAt.slice(0, 10))}.` : ""}
          </p>
          {r.lastError && <p className="text-sm text-red">Last attempt: {r.lastError}</p>}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" loading={busy} onClick={() => void run(() => api.pauseDebtReminder(debtId, !r.paused), r.paused ? "Reminders resumed" : "Reminders paused")}>
              {r.paused ? <><Play className="size-4" aria-hidden /> Resume</> : <><Pause className="size-4" aria-hidden /> Pause</>}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>Change times</Button>
            <Button size="sm" variant="ghost" loading={busy} onClick={() => void run(() => api.disableDebtReminder(debtId), "Reminders turned off")}>
              <BellOff className="size-4" aria-hidden /> Turn off
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-3">
          <p className="text-sm text-slate">Reminders are off for this debt.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" loading={busy} onClick={() => void turnOn()}>Enable reminders</Button>
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>Choose times</Button>
          </div>
          <p className="mt-2 text-sm text-slate">
            Default: three times a day at 8:00 AM, 1:00 PM and 6:00 PM.
          </p>
        </div>
      )}

      <Sheet open={editing} onOpenChange={setEditing} title="When should we email you?" description="Up to three times a day, between 6:00 AM and 9:59 PM.">
        <div className="space-y-4">
          <Field label="How often" htmlFor="edit-frequency">
            <Select
              id="edit-frequency"
              value={frequency}
              onChange={(e) => {
                const f = e.target.value as ReminderFrequency;
                setFrequency(f);
                if (f === "ONCE_DAILY") setTimes(["08:00"]);
                else if (f === "TWICE_DAILY") setTimes(["08:00", "18:00"]);
                else if (f === "THREE_TIMES_DAILY") setTimes(PRESETS);
              }}
            >
              <option value="ONCE_DAILY">Once a day</option>
              <option value="TWICE_DAILY">Twice a day</option>
              <option value="THREE_TIMES_DAILY">Three times a day</option>
              <option value="CUSTOM">Custom schedule</option>
            </Select>
          </Field>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((t) => {
              const on = times.includes(t);
              return (
                <button
                  key={t}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setTimes(on ? times.filter((x) => x !== t) : [...times, t].sort())}
                  className={cn("min-h-11 rounded-xl border px-4 text-sm font-semibold", on ? "border-emerald bg-emerald-wash text-emerald-ink" : "border-line text-slate")}
                >
                  {label(t)}
                </button>
              );
            })}
          </div>
          <Field label="Add another time" htmlFor="edit-time" optional>
            <Input id="edit-time" type="time" min="06:00" max="21:59" onChange={(e) => { const v = e.target.value; if (v && !times.includes(v)) setTimes([...times, v].sort()); }} />
          </Field>
          <Button className="w-full" loading={busy} onClick={() => void turnOn()}>Save reminder schedule</Button>
        </div>
      </Sheet>
    </section>
  );
}
