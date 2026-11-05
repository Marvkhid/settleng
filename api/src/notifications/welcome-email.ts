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

export interface WelcomeEmailInput {
  firstName: string;
  businessName: string;
  appUrl: string;
}

/**
 * The alert a person gets at the address they typed when creating their account: confirmation that
 * it exists, what to do first, and what to do if it was not them.
 */
export function renderWelcomeEmail(input: WelcomeEmailInput): {
  subject: string;
  text: string;
  html: string;
} {
  const { firstName, businessName, appUrl } = input;
  const subject = `Your SettleNG account is ready, ${firstName}`;

  const text = [
    `Hello ${firstName},`,
    '',
    `Your SettleNG account for ${businessName} was created with this email address.`,
    '',
    'Here is what to do first:',
    '1. Record a sale or an expense so your dashboard has real numbers.',
    '2. Add a debt, with the person’s email if you want them reminded too.',
    '3. Turn on Smart Debt Reminders and choose the times you want to be nudged.',
    '',
    `Open your dashboard: ${appUrl}/dashboard`,
    '',
    'Never share your password with anyone. SettleNG will never ask you for it.',
    '',
    `If you did not create this account, tell us straight away at ${SUPPORT_EMAIL} and we will remove it.`,
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
        <h1 style="margin:0 0 14px;color:${INK};font-size:22px;line-height:1.3;font-weight:800;">Your account is ready</h1>
        <p style="margin:0 0 18px;color:${SLATE};font-size:15px;line-height:1.6;">Your SettleNG account for <strong style="color:${INK};">${escapeHtml(businessName)}</strong> was created with this email address.</p>
        <p style="margin:0 0 8px;color:${INK};font-size:15px;font-weight:700;">What to do first</p>
        <ol style="margin:0 0 20px 18px;padding:0;color:${SLATE};font-size:15px;line-height:1.7;">
          <li>Record a sale or an expense so your dashboard has real numbers.</li>
          <li>Add a debt, with the person’s email if you want them reminded too.</li>
          <li>Turn on Smart Debt Reminders and choose the times you want to be nudged.</li>
        </ol>
        <table role="presentation" cellpadding="0" cellspacing="0"><tr>
          <td style="border-radius:10px;background:${BRAND};">
            <a href="${escapeHtml(appUrl)}/dashboard" style="display:inline-block;padding:14px 22px;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;">Open my dashboard</a>
          </td>
        </tr></table>
        <p style="margin:22px 0 0;color:${SLATE};font-size:14px;line-height:1.6;">Never share your password with anyone. SettleNG will never ask you for it.</p>
      </td></tr>
      <tr><td style="padding:18px 28px;background:#f7f9f8;border-top:1px solid ${LINE};">
        <p style="margin:0;color:${SLATE};font-size:12px;line-height:1.6;">If you did not create this account, tell us straight away at ${escapeHtml(SUPPORT_EMAIL)} and we will remove it.</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;

  return { subject, text, html };
}

export interface WelcomeEmailDelivery extends WelcomeEmailInput {
  to: string | null;
}

/**
 * Sends the welcome alert through whichever provider is configured.
 *
 * Sign-up must never fail because an email failed, so nothing in here throws.
 */
export async function sendWelcomeEmail(
  input: WelcomeEmailDelivery,
  log = new Logger('WelcomeEmail'),
): Promise<EmailSendResult> {
  if (!input.to) {
    return { ok: false, provider: emailProvider().name, skippedReason: 'no_recipient' };
  }
  try {
    const content = renderWelcomeEmail(input);
    const result = await emailProvider().send({
      to: input.to,
      subject: content.subject,
      text: content.text,
      html: content.html,
    });
    if (!result.ok) {
      log.warn(
        `Welcome email to the new account was not delivered (${result.skippedReason ?? result.errorCode}).`,
      );
    }
    return result;
  } catch (err) {
    log.warn(`Welcome email failed: ${String(err)}`);
    return { ok: false, provider: 'unknown', errorCode: 'send_failed' };
  }
}
