import Decimal from 'decimal.js';

export interface OpenInvoice {
  id: string;
  invoiceNumber: string;
  customerName: string;
  balance: Decimal;
  issueDate: string;
}
export interface MatchRow {
  rowNumber: number;
  description: string | null;
  amount: string;
}

const alnum = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Suggests (never confirms) which open invoice a money-in row might settle.
 * Evidence: invoice number mentioned (+3), exact balance (+2), customer name mentioned (+1).
 * A suggestion needs a score of 2+ and the row must not exceed the invoice balance.
 * Each invoice is suggested at most once per import.
 */
export function suggestMatches(
  rows: MatchRow[],
  invoices: OpenInvoice[],
): Map<number, string> {
  const result = new Map<number, string>();
  const used = new Set<string>();
  for (const row of rows) {
    const text = alnum(row.description ?? '');
    const amount = new Decimal(row.amount);
    let best: { inv: OpenInvoice; score: number } | null = null;
    for (const inv of invoices) {
      if (used.has(inv.id) || amount.gt(inv.balance)) continue;
      let score = 0;
      if (text && text.includes(alnum(inv.invoiceNumber))) score += 3;
      if (amount.eq(inv.balance)) score += 2;
      const tokens = inv.customerName
        .toLowerCase()
        .split(/\s+/)
        .filter((t) => t.length >= 4);
      if (text && tokens.some((t) => text.includes(alnum(t)))) score += 1;
      if (score < 2) continue;
      if (
        !best ||
        score > best.score ||
        (score === best.score && inv.issueDate < best.inv.issueDate)
      )
        best = { inv, score };
    }
    if (best) {
      result.set(row.rowNumber, best.inv.id);
      used.add(best.inv.id);
    }
  }
  return result;
}
