import { INestApplication, ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { AllExceptionsFilter } from './common/http-exception.filter';
import { originAllowed } from './common/origins';

/** Shared by main.ts and the integration tests so tests run the exact production pipeline. */
export function configureApp(
  app: INestApplication,
  corsOrigins: string[],
  opts: { trustProxy?: boolean } = {},
) {
  if (opts.trustProxy) {
    // Behind a host's load balancer, so rate limiting sees each visitor's real IP, not the proxy's.
    (
      app.getHttpAdapter().getInstance() as {
        set: (k: string, v: unknown) => void;
      }
    ).set('trust proxy', 1);
  }
  // JSON API: no CSP needed. Cross-origin reads are controlled by CORS below.
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.setGlobalPrefix('api');
  app.enableCors({
    origin: (
      origin: string | undefined,
      cb: (err: Error | null, allow?: boolean) => void,
    ) => cb(null, originAllowed(origin, corsOrigins)),
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
    exposedHeaders: ['Content-Disposition'],
  });
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
}
