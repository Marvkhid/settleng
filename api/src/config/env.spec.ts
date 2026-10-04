import { loadEnv } from './env';

describe('loadEnv', () => {
  it('applies safe defaults', () => {
    const env = loadEnv({});
    expect(env.port).toBe(4000);
    expect(env.corsOrigins).toEqual(['http://localhost:3000']);
    expect(env.demoMode).toBe(true);
  });

  it('parses multiple CORS origins', () => {
    const env = loadEnv({ CORS_ORIGIN: 'https://a.app, https://b.app' });
    expect(env.corsOrigins).toEqual(['https://a.app', 'https://b.app']);
  });

  it('rejects an invalid port', () => {
    expect(() => loadEnv({ PORT: 'abc' })).toThrow();
  });
});
