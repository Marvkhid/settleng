import { renderDebtorReminderEmail } from '../debt-reminders/debtor-reminder-email';
import { lagosNow, renderLoginNotice } from './login-notice-email';
import { renderWelcomeEmail } from './welcome-email';

describe('welcome email (signup alert)', () => {
  it('greets the new owner by name and names their workspace', () => {
    const mail = renderWelcomeEmail({
      firstName: 'Marvel',
      businessName: 'Marvel Stores',
      appUrl: 'https://settleng.test',
    });

    expect(mail.subject).toContain('Marvel');
    expect(mail.text).toContain('Hello Marvel,');
    expect(mail.text).toContain('Marvel Stores');
    expect(mail.text).toContain('https://settleng.test/dashboard');
    expect(mail.html).toContain('Open my dashboard');
  });

  it('tells the reader what to do if the account was not theirs', () => {
    const mail = renderWelcomeEmail({
      firstName: 'Ada',
      businessName: 'Ada Foods',
      appUrl: 'https://settleng.test',
    });
    expect(mail.text).toContain('If you did not create this account');
    expect(mail.text).toContain('will never ask you for it');
  });

  it('escapes user-supplied names so a workspace name cannot inject markup', () => {
    const mail = renderWelcomeEmail({
      firstName: 'Ada',
      businessName: '<script>alert(1)</script>',
      appUrl: 'https://settleng.test',
    });
    expect(mail.html).not.toContain('<script>');
    expect(mail.html).toContain('&lt;script&gt;');
  });
});

describe('debtor reminder email', () => {

  it('speaks for the business and shows only that debtor’s own balance', () => {
    const mail = renderDebtorReminderEmail({
      businessName: 'Marvel Stores',
      debts: [{ description: 'Balance on fabric supply', balance: '₦12,000.00' }],
      total: '₦12,000.00',
      appUrl: 'https://settleng.test',
    });

    expect(mail.subject).toBe('Payment reminder from Marvel Stores');
    expect(mail.text).toContain('friendly payment reminder from Marvel Stores');
    expect(mail.text).toContain('Balance on fabric supply: ₦12,000.00');
    expect(mail.text).toContain('If you have already paid');
    // The owner-facing wording must never leak into the debtor copy.
    expect(mail.text).not.toContain('still owes you');
    expect(mail.html).not.toContain('Marvel Stores still owes you');
  });

  it('adds a total only when the debtor owes more than one balance', () => {
    const single = renderDebtorReminderEmail({
      businessName: 'B',
      debts: [{ description: 'Rice', balance: '₦1.00' }],
      total: '₦1.00',
      appUrl: 'https://settleng.test',
    });
    expect(single.text).not.toContain('Total:');

    const multiple = renderDebtorReminderEmail({
      businessName: 'B',
      debts: [
        { description: 'Rice', balance: '₦1.00' },
        { description: 'Beans', balance: '₦2.00' },
      ],
      total: '₦3.00',
      appUrl: 'https://settleng.test',
    });
    expect(multiple.text).toContain('Total: ₦3.00');
  });
});

describe('login notice email', () => {
  const mail = renderLoginNotice({
    firstName: 'Marvel',
    when: '5 Nov 2026, 10:00',
    appUrl: 'https://settleng.test',
  });

  it('says the account was accessed, when, and to whom', () => {
    expect(mail.subject).toBe('Your SettleNG account was just accessed');
    expect(mail.text).toContain('Hello Marvel,');
    expect(mail.text).toContain('5 Nov 2026, 10:00');
    expect(mail.text).toContain('Lagos time');
  });

  it('tells the owner what to do when it was not them', () => {
    expect(mail.text).toContain('If it was not you, change your password straight away');
    expect(mail.text).toContain('https://settleng.test/forgot-password');
    expect(mail.text).toContain('adeniyimarv@gmail.com');
  });

  it('carries nothing secret — no password, token or session', () => {
    expect(mail.text.toLowerCase()).not.toContain('password:');
    expect(mail.text).not.toMatch(/eyJ[A-Za-z0-9_-]{10,}/); // no JWT
    expect(mail.text).not.toContain('Bearer');
  });

  it('formats the time in Lagos time', () => {
    expect(lagosNow(new Date('2026-11-05T09:00:00Z'))).toMatch(/2026/);
  });
});
