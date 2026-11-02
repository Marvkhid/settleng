import { formatNaira } from './money-format';

export interface ReminderEmailDebt {
  name: string;
  balance: string;
  url: string;
}

export interface ReminderEmailInput {
  ownerName: string;
  greeting: string;
  debts: ReminderEmailDebt[];
  total: string;
  timezone: string;
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
 * Owner-facing reminder email. Table-based layout with inline styles so it survives Gmail,
 * Outlook and mobile clients; the wording is a nudge to the owner, never a demand to the debtor.
 */
export function renderReminderEmail(input: ReminderEmailInput): {
  subject: string;
  text: string;
  html: string;
} {
  const { ownerName, greeting, debts, total, appUrl } = input;
  const single = debts.length === 1;
  const subject = single
    ? `Have you received ${debts[0].balance} from ${debts[0].name}?`
    : `You have ${debts.length} outstanding payments to follow up on today.`;

  const lines = debts.map(
    (d, i) => `${debts.length > 1 ? `${i + 1}. ` : ''}${d.name}: ${d.balance} — ${d.url}`,
  );
  const text = [
    `${greeting}, ${ownerName}.`,
    '',
    'A quick reminder from SettleNG.',
    '',
    single
      ? `${debts[0].name} still owes you ${debts[0].balance}.`
      : 'Here are some outstanding payments you should follow up on:',
    ...(single ? [] : ['', ...lines]),
    ...(single ? [] : ['', `Total outstanding: ${total}`]),
    '',
    single ? 'Have you received this payment?' : 'Have these customers paid you?',
    '',
    'Remember to follow up and update the payment status in your SettleNG dashboard once the money is received.',
    '',
    `View your dashboard: ${appUrl}/debts`,
    '',
    'Stay on top of your money with SettleNG.',
    '',
    'You are receiving this because you turned on automatic reminders in SettleNG. You can pause or turn them off for any debt at any time.',
  ].join('\n');

  const rows = debts
    .map(
      (d) => `
      <tr>
        <td style="padding:14px 0;border-bottom:1px solid ${LINE};">
          <a href="${escapeHtml(d.url)}" style="color:${INK};text-decoration:none;font-weight:700;font-size:16px;">${escapeHtml(d.name)}</a>
          <div style="color:${SLATE};font-size:13px;margin-top:2px;">Open this debt</div>
        </td>
        <td align="right" style="padding:14px 0;border-bottom:1px solid ${LINE};font-weight:700;font-size:16px;color:${INK};white-space:nowrap;">
          ${escapeHtml(d.balance)}
        </td>
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
        <span style="color:#ffffff;font-size:20px;font-weight:800;letter-spacing:-0.02em;">Settle<span style="color:#9fe3c8;">NG</span></span>
      </td></tr>
      <tr><td style="padding:28px;">
        <p style="margin:0 0 6px;color:${SLATE};font-size:14px;">${escapeHtml(greeting)}, ${escapeHtml(ownerName)}.</p>
        <h1 style="margin:0 0 14px;color:${INK};font-size:22px;line-height:1.3;font-weight:800;">${
          single
            ? `${escapeHtml(debts[0].name)} still owes you ${escapeHtml(debts[0].balance)}.`
            : `${debts.length} outstanding payments to follow up on`
        }</h1>
        <p style="margin:0 0 18px;color:${SLATE};font-size:15px;line-height:1.6;">A quick reminder from SettleNG.</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>
        ${
          single
            ? ''
            : `<p style="margin:16px 0 0;color:${INK};font-size:16px;font-weight:700;">Total outstanding: ${escapeHtml(total)}</p>`
        }
        <p style="margin:22px 0 8px;color:${INK};font-size:16px;font-weight:600;">${
          single ? 'Have you received this payment?' : 'Have these customers paid you?'
        }</p>
        <p style="margin:0 0 22px;color:${SLATE};font-size:15px;line-height:1.6;">Remember to follow up and update the payment status in your SettleNG dashboard once the money is received.</p>
        <table role="presentation" cellpadding="0" cellspacing="0"><tr>
          <td style="border-radius:10px;background:${BRAND};">
            <a href="${escapeHtml(appUrl)}/debts" style="display:inline-block;padding:14px 22px;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;">View Debt Details</a>
          </td>
        </tr></table>
        <p style="margin:22px 0 0;color:${INK};font-size:15px;font-weight:600;">Stay on top of your money with SettleNG.</p>
      </td></tr>
      <tr><td style="padding:18px 28px;background:#f7f9f8;border-top:1px solid ${LINE};">
        <p style="margin:0;color:${SLATE};font-size:12px;line-height:1.6;">You turned on automatic reminders for these debts. Pause or turn them off at any time from the debt page in your dashboard.</p>
        <p style="margin:6px 0 0;color:${SLATE};font-size:12px;">SettleNG · free money tracking for Nigerian businesses</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
  return { subject, text, html };
}

export const naira = (v: string): string => formatNaira(v);
