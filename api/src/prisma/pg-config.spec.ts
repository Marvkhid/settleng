import { pgSettings } from './pg-config';

describe('pgSettings', () => {
  const supabase =
    'postgresql://postgres.abc:pw@aws-0-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true&sslmode=require';

  it('uses no SSL for a local database', () => {
    expect(pgSettings('postgresql://postgres:x@localhost:5432/db').ssl).toBe(
      false,
    );
    expect(pgSettings('postgresql://postgres:x@127.0.0.1:5432/db').ssl).toBe(
      false,
    );
  });

  it('turns SSL on for a managed database and removes sslmode/pgbouncer so they cannot override it', () => {
    const s = pgSettings(supabase, {});
    expect(s.ssl).toEqual({ rejectUnauthorized: false });
    expect(s.connectionString).not.toMatch(/sslmode|pgbouncer/);
    expect(s.connectionString).toContain('pooler.supabase.com:6543/postgres');
  });

  it('verifies the certificate fully when a CA is supplied (and accepts \\n-escaped PEM)', () => {
    const s = pgSettings(supabase, {
      DATABASE_CA:
        '-----BEGIN CERTIFICATE-----\\nabc\\n-----END CERTIFICATE-----',
    });
    expect(s.ssl).toEqual({
      rejectUnauthorized: true,
      ca: '-----BEGIN CERTIFICATE-----\nabc\n-----END CERTIFICATE-----',
    });
  });

  it('lets you switch SSL off explicitly', () => {
    expect(pgSettings(supabase, { DATABASE_SSL: 'false' }).ssl).toBe(false);
  });

  it('keeps a sensible pool size', () => {
    expect(pgSettings(supabase, {}).max).toBe(10);
    expect(pgSettings(supabase, { DATABASE_POOL_MAX: '3' }).max).toBe(3);
    expect(pgSettings(supabase, { DATABASE_POOL_MAX: 'zero' }).max).toBe(10);
  });

  it('keeps the password intact, including special characters', () => {
    const s = pgSettings(
      'postgresql://u:p%40ss%2Fword@db.example.com:5432/postgres',
      {},
    );
    expect(new URL(s.connectionString).password).toBe('p%40ss%2Fword');
  });
});
