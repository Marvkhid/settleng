import { addDaysIso } from '../common/dates';

export const DEFAULT_TIMEZONE = 'Africa/Lagos';
export const SUGGESTED_TIMES = ['08:00', '13:00', '18:00'] as const;

/** Offset of `tz` at the given instant, in milliseconds (positive east of UTC). */
export function zoneOffsetMs(tz: string, at: Date): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts: Record<string, string> = {};
  for (const p of dtf.formatToParts(at)) parts[p.type] = p.value;
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return asUtc - at.getTime();
}

/** The calendar date (YYYY-MM-DD) at `at` in `tz`. */
export function zoneDate(at: Date, tz: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(at);
}

/** The hour (0–23) at `at` in `tz`, used for the greeting. */
export function zoneHour(at: Date, tz: string): number {
  return Number(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: tz,
      hour: '2-digit',
      hourCycle: 'h23',
    }).format(at),
  );
}

/** Turns a local wall-clock time in `tz` into the UTC instant it refers to. */
export function zonedToUtc(ymd: string, hhmm: string, tz: string): Date {
  const [h, m] = hhmm.split(':').map(Number);
  const naive = Date.UTC(
    Number(ymd.slice(0, 4)),
    Number(ymd.slice(5, 7)) - 1,
    Number(ymd.slice(8, 10)),
    h,
    m,
    0,
  );
  // Two passes settle the offset even across a DST boundary.
  const first = naive - zoneOffsetMs(tz, new Date(naive));
  return new Date(naive - zoneOffsetMs(tz, new Date(first)));
}

export function isValidTime(v: string): boolean {
  if (!/^\d{2}:\d{2}$/.test(v)) return false;
  const [h, m] = v.split(':').map(Number);
  return h >= 0 && h < 24 && m >= 0 && m < 60;
}

/** Quiet hours are 22:00–05:59 local: nobody wants a money reminder at 2am. */
export function isQuietHour(v: string): boolean {
  const [h] = v.split(':').map(Number);
  return h >= 22 || h < 6;
}

export function normaliseTimes(times: string[]): string[] {
  return [...new Set(times.map((t) => t.trim()))].sort();
}

/** The next delivery instant strictly after `after`, respecting the local schedule. */
export function nextRunAfter(
  after: Date,
  times: string[],
  tz: string,
): Date {
  const sorted = normaliseTimes(times).filter(isValidTime);
  const base = zoneDate(after, tz);
  for (let i = 0; i <= 2; i++) {
    const day = addDaysIso(base, i);
    for (const t of sorted) {
      const at = zonedToUtc(day, t, tz);
      if (at.getTime() > after.getTime() + 1000) return at;
    }
  }
  return zonedToUtc(addDaysIso(base, 1), sorted[0] ?? '08:00', tz);
}

export function greetingFor(hour: number): string {
  if (hour >= 5 && hour < 12) return 'Good morning';
  if (hour >= 12 && hour < 17) return 'Good afternoon';
  return 'Good evening';
}
