import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { loadEnv } from './config/env';

async function bootstrap() {
  const env = loadEnv();
  const app = await NestFactory.create(AppModule);
  configureApp(app, env.corsOrigins, { trustProxy: env.isProduction });

  const doc = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('SettleNG API')
      .setDescription(
        'SettleNG API. Money values are strings with two decimals. Every route except /api/health requires a Supabase access token.',
      )
      .setVersion('0.3.0')
      .build(),
  );
  SwaggerModule.setup('api/docs', app, doc);

  await app.listen(env.port, '0.0.0.0');
  console.log(`SettleNG API listening on port ${env.port} (${env.nodeEnv})`);
}
void bootstrap();
