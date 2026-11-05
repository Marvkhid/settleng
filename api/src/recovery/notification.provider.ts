import { Injectable, Logger } from '@nestjs/common';
import {
  emailConfigured,
  emailProvider,
  emailProviderName,
} from '../notifications/email-provider';

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
 * Email is delegated to the configured provider in `notifications/` — Gmail SMTP today, Resend
 * kept intact for production, chosen by `EMAIL_PROVIDER` or by whichever one is configured.
 * WhatsApp uses the Meta WhatsApp Cloud API with an approved template. SMS uses Termii's HTTP API.
 */
@Injectable()
export class NotificationProviders {
  private readonly log = new Logger(NotificationProviders.name);

  /** True when the selected email provider has its credentials. Never reveals them. */
  emailConfigured(): boolean {
    return emailConfigured();
  }

  /** `gmail` or `resend`, so the UI can say which one is in use. */
  emailProviderName(): string {
    return emailProviderName();
  }

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
    // The provider owns configuration checks and error codes; nothing here claims success unless
    // the provider accepted the message.
    return emailProvider().send({
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
    });
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
