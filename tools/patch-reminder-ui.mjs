import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const edit = (file, pairs) => {
  if (!existsSync(file)) { console.error('missing ' + file); return 1; }
  let s = readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  let bad = 0;
  for (const [a, b] of pairs) {
    if (!s.includes(a)) { console.error('MISSING in ' + file + ': ' + a.split('\n')[0].slice(0, 70)); bad++; continue; }
    s = s.replace(a, b);
  }
  writeFileSync(file, s);
  return bad;
};

let bad = 0;

bad += edit('web/types/api.ts', [
  [
    'export type ReminderChannel = "EMAIL" | "WHATSAPP" | "SMS";',
    `export type ReminderChannel = "EMAIL" | "WHATSAPP" | "SMS";

/* ---- Smart Debt Reminders (owner-facing scheduled emails) ---- */
export type ReminderFrequency = "ONCE_DAILY" | "TWICE_DAILY" | "THREE_TIMES_DAILY" | "CUSTOM";
export interface DebtReminderConfig {
  enabled: boolean; paused: boolean; frequency: ReminderFrequency; times: string[];
  timezone: string; nextRunAt: string | null; lastSentAt: string | null; lastError: string | null; email: string;
}
export interface DebtReminderState { debtId: string; balance: string; status: string; reminder: DebtReminderConfig | null }
export interface ReminderDelivery {
  id: string; subject: string; status: "SENT" | "FAILED" | "SKIPPED"; provider: string;
  debtCount: number; totalOutstanding: string; createdAt: string; errorCode: string | null;
}
export interface RemindersOverview {
  email: string | null; schedulerConfigured: boolean; emailConfigured: boolean;
  totals: { enabled: number; paused: number; active: number; outstanding: string; nextRunAt: string | null };
  items: Array<{
    debtId: string; name: string; description: string; balance: string; status: string;
    enabled: boolean; paused: boolean; active: boolean; frequency: ReminderFrequency; times: string[];
    timezone: string; nextRunAt: string | null; lastSentAt: string | null; lastError: string | null; email: string;
  }>;
  history: ReminderDelivery[];
}`,
  ],
]);

bad += edit('web/lib/api-client.ts', [
  [
    `  cancelReminder: (debtId: string, reminderId: string) =>
    request<{ status: string }>(\`/debts/\${debtId}/reminders/\${reminderId}\`, { method: "DELETE" }),`,
    `  cancelReminder: (debtId: string, reminderId: string) =>
    request<{ status: string }>(\`/debts/\${debtId}/reminders/\${reminderId}\`, { method: "DELETE" }),

  /* ---- Smart Debt Reminders ---- */
  debtReminder: (debtId: string) => request<DebtReminderState>(\`/debts/\${debtId}/reminder\`),
  saveDebtReminder: (debtId: string, b: { enabled: boolean; frequency: ReminderFrequency; times: string[]; timezone?: string; paused?: boolean }) =>
    request<{ enabled: boolean; paused: boolean; nextRunAt: string | null }>(\`/debts/\${debtId}/reminder\`, json("PUT", b)),
  pauseDebtReminder: (debtId: string, paused: boolean) =>
    request<{ paused: boolean; nextRunAt: string | null }>(\`/debts/\${debtId}/reminder/pause\`, json("POST", { paused })),
  disableDebtReminder: (debtId: string) =>
    request<{ enabled: boolean }>(\`/debts/\${debtId}/reminder\`, { method: "DELETE" }),
  remindersOverview: () => request<RemindersOverview>("/debt-reminders"),
  sendReminderTest: () =>
    request<{ status: string; provider: string; subject: string; to: string; reason: string | null; debtCount: number; preview: string }>(\`/debt-reminders/test\`, json("POST")),`,
  ],
  [
    'import type {',
    'import type {\n  DebtReminderState,\n  ReminderFrequency,\n  RemindersOverview,',
  ],
]);

bad += edit('web/components/shell/app-shell.tsx', [
  [
    'const SECONDARY: Item[] = [',
    'const SECONDARY: Item[] = [\n  { href: "/reminders", label: "Reminders", Icon: Bell, match: (p) => p.startsWith("/reminders") },',
  ],
  ['import {', 'import { Bell } from "lucide-react";\nimport {'],
]);

bad += edit('web/components/forms/debt-detail.tsx', [
  ['import type { DebtDetail, ReminderChannel } from "@/types/api";', 'import type { DebtDetail, ReminderChannel } from "@/types/api";\nimport { DebtReminderCard } from "@/components/ui/debt-reminder-card";'],
  [
    '      <div className="grid gap-6 lg:grid-cols-2">\n        <section className="rounded-2xl border border-line bg-surface p-5">\n          <h2 className="mb-2 text-lg font-extrabold tracking-tight">Details</h2>',
    `      <DebtReminderCard debtId={id} balance={d.balance} status={d.status} />

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-line bg-surface p-5">
          <h2 className="mb-2 text-lg font-extrabold tracking-tight">Details</h2>`,
  ],
]);

bad += edit('web/components/forms/debt-form.tsx', [
  [
    '  const [saving, setSaving] = useState(false);',
    `  const [saving, setSaving] = useState(false);
  const [remindOn, setRemindOn] = useState(false);
  const [frequency, setFrequency] = useState<"ONCE_DAILY" | "TWICE_DAILY" | "THREE_TIMES_DAILY" | "CUSTOM">("THREE_TIMES_DAILY");
  const [times, setTimes] = useState<string[]>(["08:00", "13:00", "18:00"]);`,
  ],
  [
    '      toast.success("Debt recorded");',
    `      if (remindOn) {
        try {
          await api.saveDebtReminder(debt.id, { enabled: true, frequency, times, timezone: "Africa/Lagos" });
        } catch (err) {
          toast.error(err instanceof ApiError ? err.message : "Saved the debt, but reminders could not be turned on.");
        }
      }
      toast.success("Debt recorded");`,
  ],
  [
    '        <div className="flex gap-3">',
    `        <section className="space-y-4 rounded-2xl border border-line bg-surface p-5">
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

        <div className="flex gap-3">`,
  ],
]);

bad += edit('web/app/page.tsx', [
  [
    'const STEPS = [',
    `const EXTRA_FEATURES = [
  {
    Icon: Bell,
    title: "Smart debt reminders",
    body: "Turn on automatic emails for any unpaid debt. Choose 8am, 1pm, 6pm or your own times — SettleNG emails you, never the debtor.",
  },
  {
    Icon: HandCoins,
    title: "Follow up politely",
    body: "See every balance, part payment and due date, with a shareable payment link — so chasing money never feels awkward.",
  },
  {
    Icon: FileUp,
    title: "Import a bank statement",
    body: "Upload a CSV, Excel or PDF statement. Every row is read, duplicates are blocked, and the totals must add up before they count.",
  },
  {
    Icon: Users,
    title: "Personal and business",
    body: "Keep your own money and the business separate, and invite the people who help you run it.",
  },
  {
    Icon: PieChart,
    title: "Analytics that add up",
    body: "Cash flow, spending by category, debt ageing and who owes you most — calculated from your records, never guessed.",
  },
];

const STEPS = [`,
  ],
  ['import { Reveal } from "@/components/marketing/reveal";', 'import { Bell, FileUp, HandCoins, PieChart } from "lucide-react";\nimport { Reveal } from "@/components/marketing/reveal";'],
  [
    '              {FEATURES.map((f, i) => (',
    '              {[...FEATURES, ...EXTRA_FEATURES].map((f, i) => (',
  ],
  [
    'export const metadata: Metadata = {\n  title: "SettleNG — Know where your money goes",',
    'export const metadata: Metadata = {\n  title: "SettleNG — Know where your money goes",',
  ],
]);

console.log(bad === 0 ? 'REMINDER_UI_OK' : 'REMINDER_UI_MISSING=' + bad);
