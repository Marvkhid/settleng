"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { PageHeader } from "@/components/shell/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Field, Input, MoneyInput, Select, Textarea } from "@/components/ui/field";
import { useQuery } from "@/hooks/use-query";
import { api, ApiError } from "@/lib/api-client";
import { todayIso } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Records a new debt. Money is validated here for friendliness and again on the server. */
export function DebtForm() {
  const router = useRouter();
  const customers = useQuery(() => api.customers({ pageSize: 100 }), []);
  const [direction, setDirection] = useState<"OWED_TO_ME" | "I_OWE">("OWED_TO_ME");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [principal, setPrincipal] = useState("");
  const [description, setDescription] = useState("");
  const [incurredOn, setIncurredOn] = useState(todayIso());
  const [dueOn, setDueOn] = useState("");
  const [terms, setTerms] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [remindOn, setRemindOn] = useState(false);
  const [frequency, setFrequency] = useState<"ONCE_DAILY" | "TWICE_DAILY" | "THREE_TIMES_DAILY" | "CUSTOM">("THREE_TIMES_DAILY");
  const [times, setTimes] = useState<string[]>(["08:00", "13:00", "18:00"]);

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = "Who is this about?";
    if (!/^\d{1,12}(\.\d{1,2})?$/.test(principal.trim()) || Number(principal) <= 0)
      next.principal = "Enter an amount, for example 25000";
    if (!description.trim()) next.description = "Add a short description.";
    if (!incurredOn) next.incurredOn = "Choose the date this started.";
    if (dueOn && incurredOn && dueOn < incurredOn)
      next.dueOn = "The due date cannot be before the date it started.";
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) next.email = "Enter a valid email address.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      const debt = await api.createDebt({
        counterpartyName: name.trim(),
        counterpartyPhone: phone.trim() || undefined,
        counterpartyEmail: email.trim() || undefined,
        direction,
        principal: principal.trim(),
        description: description.trim(),
        incurredOn,
        dueOn: dueOn || undefined,
        terms: terms.trim() || undefined,
        customerId: customerId || undefined,
      });
      if (remindOn) {
        try {
          await api.saveDebtReminder(debt.id, { enabled: true, frequency, times, timezone: "Africa/Lagos" });
        } catch (err) {
          toast.error(err instanceof ApiError ? err.message : "Saved the debt, but reminders could not be turned on.");
        }
      }
      toast.success("Debt recorded");
      router.push(`/debts/${debt.id}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "We couldn't save this debt.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Add a debt"
        subtitle="Record it once, then track every repayment against it."
        actions={<Link href="/debts" className={cn(buttonVariants({ variant: "outline" }))}>Back</Link>}
      />
      <form onSubmit={submit} className="max-w-2xl space-y-6" noValidate>
        <div role="group" aria-label="Direction" className="flex rounded-xl bg-sunken p-1">
          {(["OWED_TO_ME", "I_OWE"] as const).map((d) => (
            <button
              key={d}
              type="button"
              aria-pressed={direction === d}
              onClick={() => setDirection(d)}
              className={cn("min-h-11 flex-1 rounded-lg px-4 text-sm font-semibold", direction === d ? "bg-surface shadow-sm" : "text-slate")}
            >
              {d === "OWED_TO_ME" ? "Someone owes me" : "I owe someone"}
            </button>
          ))}
        </div>

        <section className="space-y-4 rounded-2xl border border-line bg-surface p-5">
          <h2 className="text-lg font-extrabold tracking-tight">
            {direction === "OWED_TO_ME" ? "Who owes you?" : "Who do you owe?"}
          </h2>
          <Field label="Name" htmlFor="debtor" error={errors.name}>
            <Input id="debtor" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} placeholder="e.g. Chidi Okonkwo" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Phone" htmlFor="debtor-phone" optional hint="Needed for SMS or WhatsApp reminders.">
              <Input id="debtor-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0803 000 0000" />
            </Field>
            <Field label="Email" htmlFor="debtor-email" optional error={errors.email} hint="Needed for email reminders.">
              <Input id="debtor-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" />
            </Field>
          </div>
          {customers.data && customers.data.items.length > 0 && direction === "OWED_TO_ME" && (
            <Field label="Link to a customer" htmlFor="debt-customer" optional hint="Keeps this debt beside their invoices.">
              <Select id="debt-customer" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                <option value="">Not linked</option>
                {customers.data.items.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </Field>
          )}
        </section>

        <section className="space-y-4 rounded-2xl border border-line bg-surface p-5">
          <h2 className="text-lg font-extrabold tracking-tight">The amount</h2>
          <Field label="Amount" htmlFor="debt-amount" error={errors.principal}>
            <MoneyInput id="debt-amount" value={principal} onChange={(e) => setPrincipal(e.target.value)} />
          </Field>
          <Field label="What is it for?" htmlFor="debt-description" error={errors.description}>
            <Input id="debt-description" value={description} maxLength={200} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Balance on fabric supply" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Started on" htmlFor="debt-incurred" error={errors.incurredOn}>
              <Input id="debt-incurred" type="date" max={todayIso()} value={incurredOn} onChange={(e) => setIncurredOn(e.target.value)} />
            </Field>
            <Field label="Due on" htmlFor="debt-due" optional error={errors.dueOn} hint="Leave empty if there is no agreed date.">
              <Input id="debt-due" type="date" min={incurredOn} value={dueOn} onChange={(e) => setDueOn(e.target.value)} />
            </Field>
          </div>
          <Field label="Terms or notes" htmlFor="debt-terms" optional>
            <Textarea id="debt-terms" value={terms} maxLength={500} onChange={(e) => setTerms(e.target.value)} placeholder="Anything agreed, e.g. ₦20,000 monthly." />
          </Field>
        </section>

        <section className="space-y-4 rounded-2xl border border-line bg-surface p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-extrabold tracking-tight">Smart email reminders</h2>
              <p className="mt-1 text-sm text-slate">We email you — never the debtor — so this debt stays on your radar.</p>
            </div>
            <label htmlFor="remind-toggle" className="flex min-h-11 items-center gap-2 text-sm font-semibold">
              <input id="remind-toggle" type="checkbox" checked={remindOn} onChange={(e) => setRemindOn(e.target.checked)} className="size-5 rounded border-line" />
              Enable reminders
            </label>
          </div>
          {remindOn && (
            <div className="space-y-3">
              <Field label="How often" htmlFor="remind-frequency">
                <Select
                  id="remind-frequency"
                  value={frequency}
                  onChange={(e) => {
                    const f = e.target.value as typeof frequency;
                    setFrequency(f);
                    if (f === "ONCE_DAILY") setTimes(["08:00"]);
                    else if (f === "TWICE_DAILY") setTimes(["08:00", "18:00"]);
                    else if (f === "THREE_TIMES_DAILY") setTimes(["08:00", "13:00", "18:00"]);
                  }}
                >
                  <option value="ONCE_DAILY">Once a day</option>
                  <option value="TWICE_DAILY">Twice a day</option>
                  <option value="THREE_TIMES_DAILY">Three times a day</option>
                  <option value="CUSTOM">Custom schedule</option>
                </Select>
              </Field>
              <fieldset>
                <legend className="text-sm font-semibold text-slate">Delivery times</legend>
                <div className="mt-2 flex flex-wrap gap-2">
                  {["08:00", "13:00", "18:00"].map((t) => {
                    const on = times.includes(t);
                    return (
                      <button
                        key={t}
                        type="button"
                        aria-pressed={on}
                        onClick={() => setTimes(on ? times.filter((x) => x !== t) : [...times, t].sort())}
                        className={cn("min-h-11 rounded-xl border px-4 text-sm font-semibold", on ? "border-emerald bg-emerald-wash text-emerald-ink" : "border-line text-slate")}
                      >
                        {t === "08:00" ? "8:00 AM" : t === "13:00" ? "1:00 PM" : "6:00 PM"}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <label htmlFor="remind-custom" className="text-sm font-semibold">Add another time</label>
                  <Input id="remind-custom" type="time" min="06:00" max="21:59" className="w-40" onChange={(e) => { const v = e.target.value; if (v && !times.includes(v)) setTimes([...times, v].sort()); }} />
                </div>
                <p className="mt-2 text-sm text-slate">Up to three times a day, between 6:00 AM and 9:59 PM.</p>
              </fieldset>
            </div>
          )}
        </section>

        <div className="flex gap-3">
          <Button type="submit" size="lg" loading={saving} className="flex-1 sm:flex-none">
            {saving ? "Saving…" : "Record debt"}
          </Button>
          <Link href="/debts" className={cn(buttonVariants({ variant: "ghost", size: "lg" }))}>Cancel</Link>
        </div>
      </form>
    </>
  );
}
