import { Logger } from '@nestjs/common';
import type { EmailMessage, EmailProvider, EmailSendResult } from './email.types';

/**
 * Resend over its HTTP API.
 *
 * Kept as-is so production can switch back at any time by setting `EMAIL_PROVIDER=resend`
 * (or by simply leaving only `RESEND_API_KEY` configured). `RESEND_BASE_URL` still allows a local
 * sink to stand in for the real endpoint during tests.
 */
export class ResendEmailProvider implements EmailProvider {
  readonly name = 'resend';
  private readonly log = new Logger('ResendEmailProvider');

  isConfigured(): boolean {
    return Boolean(process.env.RESEND_API_KEY);
  }

  private from(): string {
    // render.yaml ships RESEND_FROM while older envs use REMINDER_FROM. Accept either name so a
    // configured production sender is never silently ignored.
    return (
      process.env.REMINDER_FROM ?? process.env.RESEND_FROM ?? 'SettleNG <onboarding@resend.dev>'
    );
  }

  async send(input: EmailMessage): Promise<EmailSendResult> {
    const key = process.env.RESEND_API_KEY;
    if (!key) {
      return { ok: false, provider: this.name, skippedReason: 'provider_not_configured' };
    }
    const base = (process.env.RESEND_BASE_URL ?? 'https://api.resend.com').replace(/\/$/, '');
    try {
      const res = await fetch(`${base}/emails`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          from: this.from(),
          to: [input.to],
          subject: input.subject,
          text: input.text,
          ...(input.html ? { html: input.html } : {}),
        }),
      });
      const body = await res.text().catch(() => '');
      if (!res.ok) return { ok: false, provider: this.name, errorCode: `http_${res.status}` };
      const parsed = JSON.parse(body || '{}') as { id?: string };
      return { ok: true, provider: this.name, messageId: parsed.id };
    } catch (err) {
      this.log.warn(`Resend request failed: ${String(err)}`);
      return { ok: false, provider: this.name, errorCode: 'network_error' };
    }
  }
}
