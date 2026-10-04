/** "Today" for the business, in Lagos time (WAT, UTC+1), as YYYY-MM-DD. */
export function todayInLagos(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos' }).format(
    now,
  );
}

export const isoDate = (d: Date): string => d.toISOString().slice(0, 10);
export const toDbDate = (iso: string): Date => new Date(`${iso}T00:00:00.000Z`);

export function isRealDate(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const d = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso;
}

export function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
export const DATE_MESSAGE = 'Use a date like 2026-10-04';
