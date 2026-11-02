import { Injectable, Logger } from '@nestjs/common';

export interface SendInput {
  channel: 'EMAIL' | 'WHATSAPP' | 'SMS';
  to: string;
  subject: string;
  text: string;
  /** Optional HTML body. Email clients that refuse it still get `text`. */
  html?: string;
}

export interface SendResult {
  ok: boolean;
  provider: string;
  messageId?: string;
  errorCode?: string;
  /** Set when the channel is not configured on this deployment. Nothing was sent. */
  skippedReason?: string;
}

/**
 * Real provider integrations. Nothing here is simulated: an unconfigured channel reports
 * `provider_not_configured` and the caller records SKIPPED, so the UI never claims a message was
 * delivered when it was not.
 *
 * Email uses Resend's HTTP API (Render's free tier blocks outbound SMTP). WhatsApp uses the
 * Meta WhatsApp Cloud API with an approved template. SMS uses Termii's HTTP API.
 *
 * RESEND_BASE_URL exists so delivery can be verified end-to-end against a local sink in tests;
 * production always uses the default Resend endpoint.
 */
@Injectable()
export class NotificationProviders {
  private readonly log = new Logger(NotificationProviders.name);

  async send(input: SendInput): Promise<SendResult> {
    if (input.channel === 'EMAIL') return this.email(input);
    if (input.channel === 'WHATSAPP') return this.whatsapp(input);
    return this.sms(input);
  }

  private async post(
    url: string,
    body: unknown,
    headers: Record<string, string>,
  ): Promise<{ res: Response; body: string }> {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    });
    const text = await res.text().catch(() => '');
    return { res, body: text };
  }

  private async email(input: SendInput): Promise<SendResult> {
    const key = process.env.RESEND_API_KEY;
    if (!key) {
      return {
        ok: false,
        provider: 'resend',
        skippedReason: 'provider_not_configured',
      };
    }
    const from = process.env.REMINDER_FROM ?? 'SettleNG <onboarding@resend.dev>';
    const base = (process.env.RESEND_BASE_URL ?? 'https://api.resend.com').replace(/\/$/, '');
    try {
      const { res, body } = await this.post(
        `${base}/emails`,
        {
          from,
          to: [input.to],
          subject: input.subject,
          text: input.text,
          ...(input.html ? { html: input.html } : {}),
        },
        { Authorization: `Bearer ${key}` },
      );
      if (!res.ok)
        return {
          ok: false,
          provider: 'resend',
          errorCode: `http_${res.status}`,
        };
      const parsed = JSON.parse(body || '{}') as { id?: string };
      return { ok: true, provider: 'resend', messageId: parsed.id };
    } catch (err) {
      this.log.warn(`Resend request failed: ${String(err)}`);
      return { ok: false, provider: 'resend', errorCode: 'network_error' };
    }
  }

  private async whatsapp(input: SendInput): Promise<SendResult> {
    const token = process.env.WHATSAPP_TOKEN;
    const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    if (!token || !phoneId) {
      return {
        ok: false,
        provider: 'whatsapp_cloud',
        skippedReason: 'provider_not_configured',
      };
    }
    // Business-initiated messages must use an approved template. The template gets the reminder
    // text as its single body parameter.
    const template = process.env.WHATSAPP_TEMPLATE_NAME ?? 'debt_reminder';
    const lang = process.env.WHATSAPP_TEMPLATE_LANG ?? 'en';
    try {
      const { res, body } = await this.post(
        `https://graph.facebook.com/v21.0/${phoneId}/messages`,
        {
          messaging_product: 'whatsapp',
          to: input.to.replace(/[^\d]/g, ''),
          type: 'template',
          template: {
            name: template,
            language: { code: lang },
            components: [
              { type: 'body', parameters: [{ type: 'text', text: input.text.slice(0, 900) }] },
            ],
          },
        },
        { Authorization: `Bearer ${token}` },
      );
      if (!res.ok) {
        const code = (JSON.parse(body || '{}') as { error?: { code?: number } }).error?.code;
        return {
          ok: false,
          provider: 'whatsapp_cloud',
          errorCode: code ? `meta_${code}` : `http_${res.status}`,
        };
      }
      const parsed = JSON.parse(body || '{}') as {
        messages?: Array<{ id?: string }>;
      };
      return {
        ok: true,
        provider: 'whatsapp_cloud',
        messageId: parsed.messages?.[0]?.id,
      };
    } catch (err) {
      this.log.warn(`WhatsApp request failed: ${String(err)}`);
      return { ok: false, provider: 'whatsapp_cloud', errorCode: 'network_error' };
    }
  }

  private async sms(input: SendInput): Promise<SendResult> {
    const key = process.env.TERMII_API_KEY;
    if (!key) {
      return { ok: false, provider: 'termii', skippedReason: 'provider_not_configured' };
    }
    try {
      const { res, body } = await this.post(
        'https://api.ng.termii.com/api/sms/send',
        {
          to: input.to.replace(/[^\d+]/g, ''),
          from: process.env.TERMII_SENDER_ID ?? 'SettleNG',
          sms: `${input.subject}\n${input.text}`.slice(0, 480),
          type: 'plain',
          channel: 'generic',
          api_key: key,
        },
        {},
      );
      if (!res.ok)
        return { ok: false, provider: 'termii', errorCode: `http_${res.status}` };
      const parsed = JSON.parse(body || '{}') as { message_id?: string };
      return { ok: true, provider: 'termii', messageId: parsed.message_id };
    } catch (err) {
      this.log.warn(`Termii request failed: ${String(err)}`);
      return { ok: false, provider: 'termii', errorCode: 'network_error' };
    }
  }
}
