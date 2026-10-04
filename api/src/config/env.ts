export interface AppEnv {
  port: number;
  nodeEnv: string;
  corsOrigins: string[];
  demoMode: boolean;
}

export function loadEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  const port = Number(source.PORT ?? 4000);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error('PORT must be a positive integer');
  }
  return {
    port,
    nodeEnv: source.NODE_ENV ?? 'development',
    corsOrigins: (source.CORS_ORIGIN ?? 'http://localhost:3000')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
    demoMode: (source.DEMO_MODE ?? 'true') === 'true',
  };
}
