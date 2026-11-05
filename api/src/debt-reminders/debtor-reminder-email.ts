import { formatNaira } from './money-format';

export interface DebtorReminderDebt {
  description: string;
  balance: string;
}

export interface DebtorReminderInput {
  /** The business the debtor owes, used for the From line and the sign-off. */
  businessName: string;
  /** Only the debts of this one debtor, so nobody sees another person's balance. */
  debts: DebtorReminderDebt[];
  total: string;
  appUrl: string;
}

const BRAND = '#0f6f52';
const INK = '#12211c';
const SLATE = '#5b6b64';
const LINE = '#e3e8e5';

const escapeHtml = (s: string): string =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/**
 * The copy the debtor receives when the owner has put their email on the debt.
 *
 * Deliberately separate from `renderReminderEmail`: the owner gets a nudge about everyone who owes
 * them, while a debtor gets only their own balance. Nothing here ever lists another debtor.
 */
export function renderDebtorReminderEmail(input: DebtorReminderInput): {
  subject: string;
  text: string;
  html: string;
} {
  const { businessName, debts, total, appUrl } = input;
  const subject = `Payment reminder from ${businessName}`;

  const lines = debts.map((d) => `• ${d.description}: ${d.balance}`);
  const text = [
    'Hello,',
    '',
    `This is a friendly payment reminder from ${businessName}.`,
    '',
    ...lines,
    ...(debts.length > 1 ? ['', `Total: ${total}`] : []),
    '',
    'If you have already paid, please ignore this message and accept our thanks.',
    `To settle or discuss it, reply to this email or contact ${businessName}.`,
    '',
    `Sent on behalf of ${businessName} with SettleNG.`,
  ].join('\n');

  const rows = debts
    .map(
      (d) => `
      <tr>
        <td style="padding:14px 0;border-bottom:1px solid ${LINE};color:${INK};font-size:16px;font-weight:600;">${escapeHtml(d.description)}</td>
        <td align="right" style="padding:14px 0;border-bottom:1px solid ${LINE};font-weight:700;font-size:16px;color:${INK};white-space:nowrap;">${escapeHtml(d.balance)}</td>
      </tr>`,
    )
    .join('');

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#f4f6f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(subject)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f5;padding:24px 12px;">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid ${LINE};">
      <tr><td style="background:${BRAND};padding:20px 28px;">
        <span style="color:#ffffff;font-size:18px;font-weight:800;">${escapeHtml(businessName)}</span>
      </td></tr>
      <tr><td style="padding:28px;">
        <p style="margin:0 0 6px;color:${SLATE};font-size:14px;">Hello,</p>
        <h1 style="margin:0 0 14px;color:${INK};font-size:22px;line-height:1.3;font-weight:800;">Payment reminder from ${escapeHtml(businessName)}</h1>
        <p style="margin:0 0 18px;color:${SLATE};font-size:15px;line-height:1.6;">This is a friendly reminder about the following balance.</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>
        ${
          debts.length > 1
            ? `<p style="margin:16px 0 0;color:${INK};font-size:16px;font-weight:700;">Total: ${escapeHtml(total)}</p>`
            : ''
        }
        <p style="margin:22px 0 0;color:${SLATE};font-size:15px;line-height:1.6;">If you have already paid, please ignore this message and accept our thanks. To settle or discuss it, reply to this email or contact ${escapeHtml(businessName)}.</p>
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:22px;"><tr>
          <td style="border-radius:10px;background:${BRAND};">
            <a href="${escapeHtml(appUrl)}" style="display:inline-block;padding:14px 22px;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;">View ${escapeHtml(businessName)} on SettleNG</a>
          </td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:18px 28px;background:#f7f9f8;border-top:1px solid ${LINE};">
        <p style="margin:0;color:${SLATE};font-size:12px;line-height:1.6;">Sent on behalf of ${escapeHtml(businessName)} with SettleNG.</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
  return { subject, text, html };
}

export const naira = (v: string): string => formatNaira(v);
