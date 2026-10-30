import { Workbook } from 'exceljs';

/**
 * Turns the first worksheet of an .xlsx upload into CSV, so spreadsheets go through exactly the same
 * parsing, duplicate detection and review path as a CSV export.
 *
 * Only the first sheet is read: bank exports put the statement there, and silently merging sheets
 * would risk counting the same transaction twice.
 */

const MAX_SHEET_ROWS = 5000;

/** A cell can hold a number, a date, a hyperlink, rich text or a cached formula result. */
function cellText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'object') {
    const v = value as Record<string, unknown>;
    if (typeof v.text === 'string') return v.text; // hyperlink
    if (Array.isArray(v.richText)) {
      return v.richText
        .map((part) => (part as { text?: unknown }).text)
        .filter((t): t is string => typeof t === 'string')
        .join('');
    }
    if ('result' in v) return cellText(v.result); // formula: use its cached value
    return '';
  }
  return String(value);
}

/** RFC 4180 quoting, so a description containing a comma cannot shift the columns. */
function csvCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export async function workbookToCsv(buffer: Buffer): Promise<string> {
  const workbook = new Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);

  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error('empty workbook');

  const rows: string[][] = [];
  let columns = 0;

  sheet.eachRow({ includeEmpty: false }, (row) => {
    if (rows.length >= MAX_SHEET_ROWS) return;
    const values = row.values as unknown[];
    // row.values is 1-indexed and trailing empty cells are dropped, so rows must be padded to the
    // widest row afterwards or the columns would shift.
    const cells = values.slice(1).map(cellText);
    if (cells.every((c) => c.trim() === '')) return;
    columns = Math.max(columns, cells.length);
    rows.push(cells);
  });

  if (rows.length === 0) throw new Error('no rows');

  return rows
    .map((cells) => {
      const padded = [...cells];
      while (padded.length < columns) padded.push('');
      return padded.map(csvCell).join(',');
    })
    .join('\n');
}
