import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

const fakePrisma = {
  business: {
    findUnique: () =>
      Promise.resolve({
        id: 'demo-business',
        name: 'Adeola Mini Mart',
        currency: 'NGN',
      }),
  },
  $queryRaw: () => Promise.resolve([{ ok: 1 }]),
  $connect: () => Promise.resolve(),
  $disconnect: () => Promise.resolve(),
};

describe('API (e2e, database stubbed)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.DEMO_MODE = 'true';
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(fakePrisma)
      .compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/health returns ok', async () => {
    const res: { body: { status: string } } = await request(
      app.getHttpServer() as App,
    )
      .get('/api/health')
      .expect(200);
    expect(res.body.status).toBe('ok');
  });

  it('GET /api/demo/workspace returns the demo notice and business', async () => {
    const res: { body: { notice: string; business: { name: string } } } =
      await request(app.getHttpServer() as App)
        .get('/api/demo/workspace')
        .expect(200);
    expect(res.body.notice).toContain('Sample business');
    expect(res.body.business.name).toBe('Adeola Mini Mart');
  });
});
