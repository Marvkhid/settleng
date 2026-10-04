/**
 * CSV output that is safe to open in Excel/Sheets: any field that starts with a character a
 * spreadsheet treats as a formula (= + - @ tab CR) gets a leading apostrophe, then is quoted if needed.
 */
export function csvField(value: unknown): string {
  let s = '';
  if (typeof value === 'string') s = value;
  else if (
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint'
  )
    s = String(value);
  else if (value instanceof Date) s = value.toISOString();
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  return (
    [headers, ...rows].map((r) => r.map(csvField).join(',')).join('\r\n') +
    '\r\n'
  );
}
