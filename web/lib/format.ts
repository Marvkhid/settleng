/** Display helpers only. Authoritative money maths always happens on the server. */

export function formatNaira(value: string | number | null | undefined, opts: { signed?: "+" | "-" } = {}): string {
  const n = Number(value ?? 0);
  const whole = Number.isInteger(n);
  const body = new Intl.NumberFormat("en-NG", {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(n));
  const sign = opts.signed ?? (n < 0 ? "-" : "");
  return `${sign}₦${body}`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function todayIso(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos" }).format(now);
}

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** "Today", "Yesterday", "3 Oct" (adds the year if it is not this year). */
export function friendlyDate(iso: string, today: string = todayIso()): string {
  if (iso === today) return "Today";
  if (iso === addDays(today, -1)) return "Yesterday";
  const [y, m, d] = iso.split("-").map(Number);
  const label = `${d} ${MONTHS[m - 1]}`;
  return y === Number(today.slice(0, 4)) ? label : `${label} ${y}`;
}

/**
 * The business's timezone. SettleNG's users are Nigerian small businesses, so the greeting follows
 * Lagos time (WAT) rather than whatever timezone the visitor's device happens to be set to. A user
 * travelling abroad still sees the greeting that matches their business day.
 */
export const BUSINESS_TIME_ZONE = "Africa/Lagos";

/** The hour (0-23) at `now` in the given timezone. */
export function hourInZone(now: Date, timeZone: string = BUSINESS_TIME_ZONE): number {
  return Number(
    new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", hourCycle: "h23" }).format(now),
  );
}

/**
 * Morning 5:00–11:59, afternoon 12:00–16:59, evening 17:00–04:59, in the business timezone.
 */
export function greeting(now: Date = new Date(), timeZone: string = BUSINESS_TIME_ZONE): string {
  const hour = hourInZone(now, timeZone);
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  return "Good evening";
}

/** "Good morning, Marvel" — falls back to a neutral greeting when the name isn't loaded yet. */
export function greetingFor(
  name: string | null | undefined,
  now: Date = new Date(),
  timeZone: string = BUSINESS_TIME_ZONE,
): string {
  const clean = name?.trim();
  return clean ? `${greeting(now, timeZone)}, ${clean}` : greeting(now, timeZone);
}

export function shortDay(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]}`;
}

/** "Oct" — axis label for monthly chart buckets. */
export function monthShort(iso: string): string {
  const [, m] = iso.split("-").map(Number);
  return MONTHS[m - 1] ?? iso;
}

export const METHOD_LABEL: Record<string, string> = { CASH: "Cash", BANK_TRANSFER: "Bank transfer", POS: "POS", CREDIT: "Credit" };
