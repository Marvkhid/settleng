import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { loadEnv } from './config/env';

async function bootstrap() {
  const env = loadEnv();
  const app = await NestFactory.create(AppModule);
  configureApp(app, env.corsOrigins);

  const doc = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('SettleNG API')
      .setDescription(
        'Demo API for SettleNG. All data is fictional. Money values are strings with two decimals.',
      )
      .setVersion('0.3.0')
      .build(),
  );
  SwaggerModule.setup('api/docs', app, doc);

  await app.listen(env.port);
}
void bootstrap();
