import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AllExceptionsFilter } from './common/http-exception.filter';

/** Shared by main.ts and the integration tests so tests run the exact production pipeline. */
export function configureApp(app: INestApplication, corsOrigins: string[]) {
  app.setGlobalPrefix('api');
  app.enableCors({
    origin: corsOrigins,
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
