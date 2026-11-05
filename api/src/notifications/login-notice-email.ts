import { Logger } from '@nestjs/common';
import { emailProvider } from './email-provider';
import type { EmailSendResult } from './email.types';

/** Must match SUPPORT_EMAIL in web/components/marketing/site-footer.tsx. */
const SUPPORT_EMAIL = 'adeniyimarv@gmail.com';
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

/** Lagos local time, so the person reading it recognises when it happened. */
export function lagosNow(at: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-NG', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Africa/Lagos',
  }).format(at);
}

export interface LoginNoticeInput {
  firstName: string;
  when: string;
  appUrl: string;
}

/**
 * The "your account was just accessed" alert. It is informational, never a security gate: a
 * failure here can never keep anybody out of their account.
 */
export function renderLoginNotice(input: LoginNoticeInput): {
  subject: string;
  text: string;
  html: string;
} {
  const { firstName, when, appUrl } = input;
  const subject = 'Your SettleNG account was just accessed';

  const text = [
    `Hello ${firstName},`,
    '',
    `Your SettleNG account was accessed on ${when} (Lagos time).`,
    '',
    'If this was you, there is nothing to do.',
    '',
    `If it was not you, change your password straight away at ${appUrl}/forgot-password and contact ${SUPPORT_EMAIL} so we can lock the account.`,
    '',
    '— SettleNG',
  ].join('\n');

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
        <p style="margin:0 0 6px;color:${SLATE};font-size:14px;">Hello ${escapeHtml(firstName)},</p>
        <h1 style="margin:0 0 14px;color:${INK};font-size:22px;line-height:1.3;font-weight:800;">Your account was just accessed</h1>
        <p style="margin:0 0 18px;color:${SLATE};font-size:15px;line-height:1.6;">Your SettleNG account was accessed on <strong style="color:${INK};">${escapeHtml(when)}</strong> (Lagos time).</p>
        <p style="margin:0 0 8px;color:${INK};font-size:15px;font-weight:600;">If this was you, there is nothing to do.</p>
        <p style="margin:0;color:${SLATE};font-size:15px;line-height:1.6;">If it was not you, change your password straight away and contact ${escapeHtml(SUPPORT_EMAIL)} so we can lock the account.</p>
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:22px;"><tr>
          <td style="border-radius:10px;background:${BRAND};">
            <a href="${escapeHtml(appUrl)}/forgot-password" style="display:inline-block;padding:14px 22px;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;">Change my password</a>
          </td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:18px 28px;background:#f7f9f8;border-top:1px solid ${LINE};">
        <p style="margin:0;color:${SLATE};font-size:12px;line-height:1.6;">You are receiving this because someone signed in to the SettleNG account registered to this address.</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;

  return { subject, text, html };
}

export interface LoginNoticeDelivery extends LoginNoticeInput {
  to: string | null;
}

export async function sendLoginNotice(
  input: LoginNoticeDelivery,
  log = new Logger('LoginNoticeEmail'),
): Promise<EmailSendResult> {
  if (!input.to) {
    return { ok: false, provider: emailProvider().name, skippedReason: 'no_recipient' };
  }
  try {
    const content = renderLoginNotice(input);
    const result = await emailProvider().send({
      to: input.to,
      subject: content.subject,
      text: content.text,
      html: content.html,
    });
    if (!result.ok) {
      log.warn(
        `Login notice was not delivered (${result.skippedReason ?? result.errorCode}). The sign-in itself still succeeded.`,
      );
    }
    return result;
  } catch (err) {
    log.warn(`Login notice failed: ${String(err)}`);
    return { ok: false, provider: 'unknown', errorCode: 'send_failed' };
  }
}
