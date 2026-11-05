/**
 * The contract every email provider implements.
 *
 * The reminder system (Smart Debt Reminders, the recovery scheduler and the "send me a test"
 * button) only ever talks to this interface, so swapping Gmail SMTP for Resend — or adding
 * another provider later — never touches reminder code.
 *
 * A provider must never report `ok: true` unless the provider actually accepted the message.
 */
export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  /** Optional HTML body. Clients that refuse it still get `text`. */
  html?: string;
}

export interface EmailSendResult {
  ok: boolean;
  /** Recorded in delivery history: `resend`, `gmail_smtp`, … */
  provider: string;
  messageId?: string;
  errorCode?: string;
  /** Set when this provider is not configured on this deployment. Nothing was sent. */
  skippedReason?: string;
}

export interface EmailProvider {
  readonly name: string;
  /** True when the environment carries everything this provider needs to send. */
  isConfigured(): boolean;
  send(message: EmailMessage): Promise<EmailSendResult>;
}
