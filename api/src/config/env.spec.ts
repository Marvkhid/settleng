import { loadEnv } from './env';

describe('loadEnv', () => {
  it('applies safe defaults in development', () => {
    const env = loadEnv({});
    expect(env.port).toBe(4000);
    expect(env.corsOrigins).toEqual(['http://localhost:3000']);
    expect(env.isProduction).toBe(false);
  });

  it('parses multiple CORS origins', () => {
    const env = loadEnv({ CORS_ORIGIN: 'https://a.app, https://b.app' });
    expect(env.corsOrigins).toEqual(['https://a.app', 'https://b.app']);
  });

  it('rejects an invalid port', () => {
    expect(() => loadEnv({ PORT: 'abc' })).toThrow();
  });

  describe('production', () => {
    const good = {
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://x',
      CORS_ORIGIN: 'https://settleng.vercel.app',
      SUPABASE_URL: 'https://xyz.supabase.co',
    };

    it('starts with a complete configuration', () => {
      const env = loadEnv(good);
      expect(env.isProduction).toBe(true);
      expect(env.corsOrigins).toEqual(['https://settleng.vercel.app']);
    });

    it('refuses to start without a database or CORS origin, and says what to set', () => {
      expect(() => loadEnv({ NODE_ENV: 'production' })).toThrow(
        /DATABASE_URL[\s\S]*CORS_ORIGIN/,
      );
      expect(() => loadEnv({ ...good, CORS_ORIGIN: '' })).toThrow(
        /CORS_ORIGIN/,
      );
      expect(() => loadEnv({ ...good, DATABASE_URL: '' })).toThrow(
        /DATABASE_URL/,
      );
    });

    it('refuses wildcard or non-URL origins', () => {
      expect(() => loadEnv({ ...good, CORS_ORIGIN: '*' })).toThrow(/not "\*"/);
      expect(() =>
        loadEnv({ ...good, CORS_ORIGIN: 'settleng.vercel.app' }),
      ).toThrow(/full URLs/);
    });
  });
});
