export interface AppEnv {
  port: number;
  nodeEnv: string;
  corsOrigins: string[];
  isProduction: boolean;
}

/**
 * Reads and checks configuration. In production it refuses to start with unsafe or missing settings,
 * so a misconfigured deploy fails loudly instead of running half-working.
 */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  const port = Number(source.PORT ?? 4000);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error('PORT must be a positive integer');
  }
  const nodeEnv = source.NODE_ENV ?? 'development';
  const isProduction = nodeEnv === 'production';
  const corsOrigins = (source.CORS_ORIGIN ?? 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  if (isProduction) {
    const problems: string[] = [];
    if (!source.DATABASE_URL)
      problems.push(
        'DATABASE_URL is not set (your Supabase pooled connection string).',
      );
    if (!source.CORS_ORIGIN)
      problems.push(
        'CORS_ORIGIN is not set (the exact URL of your website, for example https://settleng.vercel.app).',
      );
    if (corsOrigins.some((o) => o === '*' || !/^https?:\/\//.test(o)))
      problems.push(
        'CORS_ORIGIN must be full URLs like https://settleng.vercel.app, not "*".',
      );
    if (!source.SUPABASE_URL && !source.SUPABASE_JWT_SECRET)
      problems.push(
        'SUPABASE_URL is not set (your Supabase project URL, e.g. https://xyz.supabase.co). It lets the API verify sign-in tokens.',
      );
    if (problems.length)
      throw new Error(
        `Cannot start in production:\n - ${problems.join('\n - ')}`,
      );
  }

  return {
    port,
    nodeEnv,
    corsOrigins,
    isProduction,
  };
}
