export interface PgSettings {
  connectionString: string;
  ssl: false | { rejectUnauthorized: boolean; ca?: string };
  max: number;
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

/**
 * Turns a DATABASE_URL into node-postgres settings.
 * - Local databases: no SSL.
 * - Managed databases (Supabase, Neon...): SSL on. If DATABASE_CA holds the provider's CA certificate we
 *   verify it fully; otherwise we encrypt without verifying the certificate chain (Supabase's CA is not in
 *   Node's default store). Set DATABASE_SSL=false to turn SSL off.
 * - `sslmode` and `pgbouncer` are removed from the URL: node-postgres would let `sslmode` override these settings.
 */
export function pgSettings(
  rawUrl: string,
  env: NodeJS.ProcessEnv = process.env,
): PgSettings {
  const url = new URL(rawUrl);
  url.searchParams.delete('sslmode');
  url.searchParams.delete('pgbouncer');
  const local = LOCAL_HOSTS.has(url.hostname);
  let ssl: PgSettings['ssl'] = false;
  if (!local && env.DATABASE_SSL !== 'false') {
    ssl = env.DATABASE_CA
      ? { rejectUnauthorized: true, ca: env.DATABASE_CA.replace(/\\n/g, '\n') }
      : { rejectUnauthorized: false };
  }
  const max = Number(env.DATABASE_POOL_MAX ?? 10);
  return {
    connectionString: url.toString(),
    ssl,
    max: Number.isInteger(max) && max > 0 ? max : 10,
  };
}
