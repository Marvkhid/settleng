import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

const fakePrisma = {
  business: { findUnique: () => Promise.resolve(null) },
  profile: { findUnique: () => Promise.resolve(null) },
  $queryRaw: () => Promise.resolve([{ ok: 1 }]),
  $connect: () => Promise.resolve(),
  $disconnect: () => Promise.resolve(),
};

describe('API (e2e, database stubbed)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.SUPABASE_JWT_SECRET = 'settleng-integration-test-secret';
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

  it('GET /api/health returns ok (public)', async () => {
    const res: { body: { status: string } } = await request(
      app.getHttpServer() as App,
    )
      .get('/api/health')
      .expect(200);
    expect(res.body.status).toBe('ok');
  });

  it('GET /api/health/ready returns ok (public)', async () => {
    const res: { body: { status: string } } = await request(
      app.getHttpServer() as App,
    )
      .get('/api/health/ready')
      .expect(200);
    expect(res.body.status).toBe('ok');
  });

  it('protected route rejects a request with no token', async () => {
    await request(app.getHttpServer() as App)
      .get('/api/dashboard')
      .expect(401);
  });
});
