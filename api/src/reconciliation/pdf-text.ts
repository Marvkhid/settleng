import { inflateSync } from 'zlib';

/**
 * Minimal, dependency-free PDF text extraction for text-based bank statements.
 *
 * PDF has no concept of a "row", so the honest approach is: pull the text runs out of the content
 * streams, rebuild lines by their vertical position, then only accept a line as a transaction when
 * it starts with a date and ends with an amount. Anything else is dropped rather than guessed at.
 * Scanned PDFs contain no text at all, and are refused with an explanation.
 */

const unescape = (s: string): string =>
  s.replace(/\\([nrtbf()\\]|[0-7]{1,3})/g, (_m, g: string) => {
    switch (g) {
      case 'n':
        return '\n';
      case 'r':
        return '\r';
      case 't':
        return '\t';
      case 'b':
        return '\b';
      case 'f':
        return '\f';
      case '(':
        return '(';
      case ')':
        return ')';
      case '\\':
        return '\\';
      default:
        return String.fromCharCode(parseInt(g, 8));
    }
  });

/** Decoded content streams, in the order they appear in the file (page order for normal PDFs). */
function contentStreams(pdf: Buffer): string[] {
  const raw = pdf.toString('latin1');
  const out: string[] = [];
  const marker = /stream\r?\n/g;
  let m: RegExpExecArray | null;
  while ((m = marker.exec(raw))) {
    const start = m.index + m[0].length;
    const end = raw.indexOf('endstream', start);
    if (end < 0) continue;
    const body = Buffer.from(pdf.subarray(start, end));
    const dict = raw.slice(Math.max(0, m.index - 600), m.index);
    let text: string | null;
    if (/FlateDecode/.test(dict)) {
      try {
        text = inflateSync(body).toString('latin1');
      } catch {
        text = null;
      }
    } else text = body.toString('latin1');
    if (text && /\bBT\b/.test(text)) out.push(text);
    marker.lastIndex = end;
  }
  return out;
}

type Piece = { x: number; y: number; text: string };

/** Text runs with their position, read from BT…ET blocks. */
function runs(content: string): Piece[] {
  const pieces: Piece[] = [];
  for (const block of content.split('BT').slice(1)) {
    const body = block.split('ET')[0] ?? '';
    let x = 0;
    let y = 0;
    let lineX = 0;
    let buf = '';
    const flush = () => {
      if (buf.trim()) pieces.push({ x: lineX, y, text: buf.trim() });
      buf = '';
    };
    const ops =
      /(-?[\d.]+)\s+(-?[\d.]+)\s+TD|(-?[\d.]+)\s+(-?[\d.]+)\s+Td|(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+Tm|\(((?:\\.|[^\\()])*)\)\s*Tj|\[((?:[^\]]*))\]\s*TJ/g;
    let m: RegExpExecArray | null;
    while ((m = ops.exec(body))) {
      if (m[1] !== undefined) {
        // TD sets the leading and moves the line origin.
        flush();
        x += Number(m[1]);
        y += Number(m[2]);
        lineX = x;
      } else if (m[3] !== undefined) {
        flush();
        x += Number(m[3]);
        y += Number(m[4]);
        lineX = x;
      } else if (m[5] !== undefined) {
        flush();
        x = Number(m[9]);
        y = Number(m[10]);
        lineX = x;
      } else if (m[11] !== undefined) {
        if (!buf) lineX = x;
        buf += unescape(m[11]);
      } else if (m[12] !== undefined) {
        if (!buf) lineX = x;
        for (const s of m[12].matchAll(/\(((?:\\.|[^\\()])*)\)/g))
          buf += unescape(s[1]);
      }
    }
    flush();
  }
  return pieces;
}

/** Rebuild visual lines: same y (within 2 units), ordered top-down, left-to-right. */
export function pdfLines(pdf: Buffer): string[] {
  const lines: string[] = [];
  for (const content of contentStreams(pdf)) {
    const groups = new Map<number, Piece[]>();
    for (const p of runs(content)) {
      const key = Math.round(p.y / 2) * 2;
      const arr = groups.get(key) ?? [];
      arr.push(p);
      groups.set(key, arr);
    }
    const page = [...groups.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([, ps]) =>
        ps
          .sort((a, b) => a.x - b.x)
          .map((p) => p.text)
          .join('  ')
          .replace(/\s+/g, ' ')
          .trim(),
      );
    lines.push(...page);
  }
  return lines;
}

const DATE_LINE =
  /^(\d{4}-\d{2}-\d{2}|\d{1,2}[/-]\d{1,2}[/-]\d{4})\s+(.+)$/;
const TRAILING_AMOUNT =
  /^(.*?)\s+(-?[\d,]+\.\d{2})(?:\s*(CR|DR))?$/i;
const BALANCE_LINE = /^(opening|closing)\s+balance\b/i;

const csvCell = (v: string): string =>
  /[",]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;

export interface PdfStatement {
  csv: string;
  rows: number;
}

/**
 * Turns a text-based PDF statement into the same CSV shape the uploader already understands.
 * Returns zero rows when the file has no readable text so the caller can explain why.
 */
export function pdfToStatementCsv(pdf: Buffer): PdfStatement {
  const out: string[] = ['Date,Description,Amount,Direction,Reference'];
  let rows = 0;
  for (const line of pdfLines(pdf)) {
    const d = DATE_LINE.exec(line);
    if (!d) continue;
    const a = TRAILING_AMOUNT.exec(d[2]);
    if (!a) continue;
    const description = a[1].trim();
    if (!description) continue;
    const amount = a[2].replace(/,/g, '');
    const suffix = (a[3] ?? '').toUpperCase();
    const direction =
      suffix === 'CR'
        ? 'IN'
        : suffix === 'DR'
          ? 'OUT'
          : amount.startsWith('-')
            ? 'OUT'
            : 'IN';
    out.push(
      [d[1], csvCell(BALANCE_LINE.test(description) ? description : description), amount, direction, ''].join(','),
    );
    rows++;
  }
  return { csv: out.join('\n') + '\n', rows };
}
