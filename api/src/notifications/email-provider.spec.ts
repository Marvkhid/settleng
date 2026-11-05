import type SMTPTransport from 'nodemailer/lib/smtp-transport';
import {
  GMAIL_SMTP_HOST,
  GMAIL_SMTP_PORT,
  GmailSmtpEmailProvider,
  classifySmtpError,
} from './gmail-smtp.email-provider';
import { ResendEmailProvider } from './resend.email-provider';
import { emailConfigured, emailProvider, emailProviderName } from './email-provider';

const MESSAGE = {
  to: 'owner@settleng.test',
  subject: 'You are owed ₦2,500.00',
  text: 'Ada Obi owes you ₦2,500.00.',
  html: '<p>Ada Obi owes you ₦2,500.00.</p>',
};

const ENV_KEYS = [
  'GMAIL_USER',
  'GMAIL_APP_PASSWORD',
  'GMAIL_FROM',
  'EMAIL_PROVIDER',
  'RESEND_API_KEY',
  'RESEND_FROM',
  'REMINDER_FROM',
  'RESEND_BASE_URL',
];

let saved: Record<string, string | undefined>;

beforeEach(() => {
  saved = {};
  for (const k of ENV_KEYS) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  jest.restoreAllMocks();
});

function gmailProvider(options?: {
  sendMail?: jest.Mock;
  onOptions?: (o: SMTPTransport.Options) => void;
}) {
  const sendMail = options?.sendMail ?? jest.fn();
  const factory = jest.fn((o: SMTPTransport.Options) => {
    options?.onOptions?.(o);
    return { sendMail } as unknown as ReturnType<typeof import('nodemailer').createTransport>;
  });
  return { provider: new GmailSmtpEmailProvider(factory), factory, sendMail };
}

describe('gmail SMTP provider', () => {
  it('reports not configured and sends nothing without credentials', async () => {
    const { provider, factory, sendMail } = gmailProvider();
    expect(provider.isConfigured()).toBe(false);

    const result = await provider.send(MESSAGE);

    expect(result).toEqual({
      ok: false,
      provider: 'gmail_smtp',
      skippedReason: 'provider_not_configured',
    });
    expect(factory).not.toHaveBeenCalled();
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('connects to smtp.gmail.com:587 with STARTTLS and the app password', async () => {
    process.env.GMAIL_USER = 'settleng.mail@gmail.com';
    process.env.GMAIL_APP_PASSWORD = 'abcd efgh ijkl mnop';
    let seen: SMTPTransport.Options | undefined;
    const { provider } = gmailProvider({
      sendMail: jest.fn().mockResolvedValue({ accepted: ['owner@settleng.test'], rejected: [] }),
      onOptions: (o) => (seen = o),
    });

    await provider.send(MESSAGE);

    expect(seen).toMatchObject({
      host: GMAIL_SMTP_HOST,
      port: GMAIL_SMTP_PORT,
      secure: false, // 587 upgrades in-band
      requireTLS: true, // and never sends in the clear
      auth: { user: 'settleng.mail@gmail.com', pass: 'abcdefghijklmnop' },
    });
    expect(GMAIL_SMTP_HOST).toBe('smtp.gmail.com');
    expect(GMAIL_SMTP_PORT).toBe(587);
  });

  it('counts the message as sent only when the server accepted the recipient', async () => {
    process.env.GMAIL_USER = 'settleng.mail@gmail.com';
    process.env.GMAIL_APP_PASSWORD = 'apppassword';
    const { provider, sendMail } = gmailProvider();
    sendMail.mockResolvedValue({
      accepted: ['owner@settleng.test'],
      rejected: [],
      messageId: '<abc@gmail.com>',
    });

    const result = await provider.send(MESSAGE);

    expect(result).toEqual({
      ok: true,
      provider: 'gmail_smtp',
      messageId: '<abc@gmail.com>',
    });
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'SettleNG <settleng.mail@gmail.com>',
        to: 'owner@settleng.test',
        subject: MESSAGE.subject,
        text: MESSAGE.text,
        html: MESSAGE.html,
      }),
    );
  });

  it('does not report success when the server rejects the recipient', async () => {
    process.env.GMAIL_USER = 'settleng.mail@gmail.com';
    process.env.GMAIL_APP_PASSWORD = 'apppassword';
    const { provider, sendMail } = gmailProvider();
    sendMail.mockResolvedValue({ accepted: [], rejected: ['owner@settleng.test'], messageId: '' });

    const result = await provider.send(MESSAGE);

    expect(result).toEqual({
      ok: false,
      provider: 'gmail_smtp',
      errorCode: 'smtp_recipient_rejected',
    });
  });

  it('turns SMTP failures into recorded error codes instead of throwing', async () => {
    process.env.GMAIL_USER = 'settleng.mail@gmail.com';
    process.env.GMAIL_APP_PASSWORD = 'apppassword';
    const cases: Array<[string, string]> = [
      ['EAUTH', 'smtp_auth_failed'],
      ['ECONNECTION', 'network_error'],
      ['ETIMEDOUT', 'network_error'],
      ['EENVELOPE', 'smtp_recipient_rejected'],
      ['ESOMETHINGELSE', 'smtp_error'],
    ];
    for (const [code, expected] of cases) {
      const { provider, sendMail } = gmailProvider();
      sendMail.mockRejectedValue(Object.assign(new Error('boom'), { code }));
      const result = await provider.send(MESSAGE);
      expect(result).toEqual({ ok: false, provider: 'gmail_smtp', errorCode: expected });
    }
    expect(
      classifySmtpError(Object.assign(new Error('nope'), { code: 'EAUTH' })),
    ).toBe('smtp_auth_failed');
  });

  it('reuses one SMTP transport for repeated sends', async () => {
    process.env.GMAIL_USER = 'settleng.mail@gmail.com';
    process.env.GMAIL_APP_PASSWORD = 'apppassword';
    const { provider, factory, sendMail } = gmailProvider();
    sendMail.mockResolvedValue({ accepted: ['a@b.test'], rejected: [], messageId: '<1@x>' });

    await provider.send(MESSAGE);
    await provider.send({ ...MESSAGE, to: 'second@settleng.test' });

    expect(factory).toHaveBeenCalledTimes(1); // no new connection pool per email
    expect(sendMail).toHaveBeenCalledTimes(2);
  });
});

describe('resend provider', () => {
  it('reports not configured instead of calling the API', async () => {
    const fetchSpy = jest.spyOn(globalThis, 'fetch');
    const result = await new ResendEmailProvider().send(MESSAGE);
    expect(result).toEqual({
      ok: false,
      provider: 'resend',
      skippedReason: 'provider_not_configured',
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('still sends through Resend when it is the selected provider', async () => {
    process.env.RESEND_API_KEY = 're_test_key';
    process.env.RESEND_BASE_URL = 'https://api.resend.test/';
    const fetchSpy = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ id: 'rs_1' }), { status: 200 }));

    const result = await new ResendEmailProvider().send(MESSAGE);

    expect(result).toEqual({ ok: true, provider: 'resend', messageId: 'rs_1' });
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.resend.test/emails');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer re_test_key');
    expect(JSON.parse(init.body as string)).toMatchObject({ to: ['owner@settleng.test'] });
  });

  it('records the HTTP status when Resend refuses the message', async () => {
    process.env.RESEND_API_KEY = 're_test_key';
    jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ message: 'no' }), { status: 403 }));

    const result = await new ResendEmailProvider().send(MESSAGE);

    expect(result).toEqual({ ok: false, provider: 'resend', errorCode: 'http_403' });
  });
});

describe('provider selection', () => {
  it('uses Gmail when only Gmail is configured', () => {
    process.env.GMAIL_USER = 'settleng.mail@gmail.com';
    process.env.GMAIL_APP_PASSWORD = 'apppassword';
    expect(emailProviderName()).toBe('gmail');
    expect(emailProvider().name).toBe('gmail_smtp');
    expect(emailConfigured()).toBe(true);
  });

  it('keeps Resend available when only Resend is configured', () => {
    process.env.RESEND_API_KEY = 're_test_key';
    expect(emailProviderName()).toBe('resend');
    expect(emailProvider().name).toBe('resend');
    expect(emailConfigured()).toBe(true);
  });

  it('lets EMAIL_PROVIDER override what is configured', () => {
    process.env.GMAIL_USER = 'settleng.mail@gmail.com';
    process.env.GMAIL_APP_PASSWORD = 'apppassword';
    process.env.RESEND_API_KEY = 're_test_key';
    process.env.EMAIL_PROVIDER = 'resend';
    expect(emailProviderName()).toBe('resend');

    process.env.EMAIL_PROVIDER = 'gmail';
    expect(emailProviderName()).toBe('gmail');
  });

  it('reports email as unconfigured when no provider has credentials', () => {
    expect(emailConfigured()).toBe(false);
  });
});
