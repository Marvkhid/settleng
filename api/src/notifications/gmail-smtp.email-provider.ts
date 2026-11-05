import { Logger } from '@nestjs/common';
import { createTransport, type Transporter } from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';
import type { EmailMessage, EmailProvider, EmailSendResult } from './email.types';

/** Gmail's submission endpoint. 587 is STARTTLS: the session starts in the clear and is
 *  upgraded in-band, which is why `secure` is false and `requireTLS` is true. */
export const GMAIL_SMTP_HOST = 'smtp.gmail.com';
export const GMAIL_SMTP_PORT = 587;

type TransportFactory = (options: SMTPTransport.Options) => Transporter<SMTPTransport.SentMessageInfo>;

interface GmailCredentials {
  user: string;
  pass: string;
}

/** Reads the credentials from the server environment only — they never reach the web app. */
function readCredentials(env: NodeJS.ProcessEnv = process.env): GmailCredentials | null {
  const user = env.GMAIL_USER?.trim();
  // Google prints app passwords in groups of four separated by spaces; spaces are not part of it.
  const pass = env.GMAIL_APP_PASSWORD?.replace(/\s+/g, '');
  if (!user || !pass) return null;
  return { user, pass };
}

/**
 * Maps a Nodemailer failure onto the short codes the delivery history stores. Never includes the
 * password (or the SMTP dialogue, which can contain the username) in what we record.
 */
export function classifySmtpError(err: unknown): string {
  const code = (err as { code?: string }).code;
  switch (code) {
    case 'EAUTH':
      return 'smtp_auth_failed';
    case 'EENVELOPE':
      return 'smtp_recipient_rejected';
    case 'ETIMEDOUT':
    case 'ESOCKET':
    case 'ECONNECTION':
    case 'EDNS':
    case 'ECONNREFUSED':
      return 'network_error';
    default:
      return 'smtp_error';
  }
}

/**
 * Gmail SMTP through Nodemailer.
 *
 * Sends from the authenticated Gmail account itself: Gmail refuses a From address it does not own
 * unless an alias is configured, so the sender is the configured user unless GMAIL_FROM says
 * otherwise. A message counts as sent only when the SMTP server lists the recipient as accepted.
 */
export class GmailSmtpEmailProvider implements EmailProvider {
  readonly name = 'gmail_smtp';
  private readonly log = new Logger('GmailSmtpEmailProvider');
  private cached: { key: string; transporter: Transporter<SMTPTransport.SentMessageInfo> } | null =
    null;

  constructor(private readonly makeTransport: TransportFactory = (options) => createTransport(options)) {}

  isConfigured(): boolean {
    return readCredentials() !== null;
  }

  private transporterFor(creds: GmailCredentials) {
    const key = `${creds.user}\u0000${creds.pass}`;
    if (this.cached?.key === key) return this.cached.transporter;
    const transporter = this.makeTransport({
      host: GMAIL_SMTP_HOST,
      port: GMAIL_SMTP_PORT,
      secure: false,
      requireTLS: true,
      auth: { user: creds.user, pass: creds.pass },
      // A hung SMTP session must fail the delivery, not hold the scheduler's request open.
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    });
    this.cached = { key, transporter };
    return transporter;
  }

  async send(input: EmailMessage): Promise<EmailSendResult> {
    const creds = readCredentials();
    if (!creds) {
      return { ok: false, provider: this.name, skippedReason: 'provider_not_configured' };
    }
    try {
      const info = await this.transporterFor(creds).sendMail({
        from: process.env.GMAIL_FROM?.trim() || `SettleNG <${creds.user}>`,
        to: input.to,
        subject: input.subject,
        text: input.text,
        ...(input.html ? { html: input.html } : {}),
      });
      const accepted = info?.accepted ?? [];
      if (accepted.length === 0) {
        // A 250 for the message but no accepted recipient means the address was refused.
        const rejected = JSON.stringify(info?.rejected ?? []);
        this.log.warn(`Gmail SMTP did not accept ${input.to} (rejected: ${rejected})`);
        return { ok: false, provider: this.name, errorCode: 'smtp_recipient_rejected' };
      }
      return { ok: true, provider: this.name, messageId: info?.messageId };
    } catch (err) {
      const errorCode = classifySmtpError(err);
      const message = err instanceof Error ? err.message : String(err);
      this.log.warn(`Gmail SMTP send failed (${errorCode}): ${message.slice(0, 200)}`);
      return { ok: false, provider: this.name, errorCode };
    }
  }
}
