import type { EmailProvider } from './email.types';
import { GmailSmtpEmailProvider } from './gmail-smtp.email-provider';
import { ResendEmailProvider } from './resend.email-provider';

export type EmailProviderName = 'gmail' | 'resend';

const gmail = new GmailSmtpEmailProvider();
const resend = new ResendEmailProvider();

/**
 * Picks the provider.
 *
 * `EMAIL_PROVIDER=gmail|resend` pins one explicitly. Without it, whichever provider the environment
 * actually configures wins, Gmail first, so a deployment that sets only GMAIL_USER/GMAIL_APP_PASSWORD
 * sends through Gmail and one that sets only RESEND_API_KEY keeps using Resend — no code change.
 */
export function emailProviderName(env: NodeJS.ProcessEnv = process.env): EmailProviderName {
  const explicit = env.EMAIL_PROVIDER?.trim().toLowerCase();
  if (explicit === 'gmail' || explicit === 'resend') return explicit;
  if (readGmailConfigured(env)) return 'gmail';
  if (env.RESEND_API_KEY) return 'resend';
  return 'gmail';
}

function readGmailConfigured(env: NodeJS.ProcessEnv): boolean {
  return Boolean(env.GMAIL_USER?.trim() && env.GMAIL_APP_PASSWORD?.replace(/\s+/g, ''));
}

export function emailProvider(env: NodeJS.ProcessEnv = process.env): EmailProvider {
  return emailProviderName(env) === 'resend' ? resend : gmail;
}

/** True when the provider that would be used right now can actually send. */
export function emailConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return emailProvider(env).isConfigured();
}
