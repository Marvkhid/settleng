import { originAllowed } from './origins';

describe('originAllowed', () => {
  const allowed = [
    'https://settleng.vercel.app',
    'https://settleng-*.vercel.app',
  ];

  it('allows exact origins, ignoring case and a trailing slash', () => {
    expect(originAllowed('https://settleng.vercel.app', allowed)).toBe(true);
    expect(originAllowed('https://SettleNG.vercel.app/', allowed)).toBe(true);
  });
  it('allows Vercel preview URLs that match the pattern', () => {
    expect(
      originAllowed('https://settleng-git-main-marvel.vercel.app', allowed),
    ).toBe(true);
  });
  it('rejects look-alikes and other sites', () => {
    for (const bad of [
      'https://evil.com',
      'https://settleng.vercel.app.evil.com',
      'http://settleng.vercel.app',
      'https://settleng-a.b.vercel.app',
      'https://evil.com/.vercel.app',
      'https://settleng-.evil.com',
      'https://xsettleng.vercel.app',
    ])
      expect(originAllowed(bad, allowed)).toBe(false);
  });
  it('treats a missing Origin (curl, health checks) as allowed', () => {
    expect(originAllowed(undefined, allowed)).toBe(true);
  });
});
