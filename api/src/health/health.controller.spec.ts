import { ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { HealthController } from './health.controller';

const make = (dbUp: boolean) => {
  const prisma = {
    $queryRaw: jest
      .fn()
      .mockImplementation(() =>
        dbUp
          ? Promise.resolve([{ '?column?': 1 }])
          : Promise.reject(new Error('ECONNREFUSED')),
      ),
  } as unknown as PrismaService;
  return new HealthController(prisma);
};

describe('HealthController', () => {
  it('liveness never touches the database', () => {
    const res = make(false).check();
    expect(res.status).toBe('ok');
    expect(res.service).toBe('settleng-api');
  });

  it('readiness reports the database is up when it answers', async () => {
    expect(await make(true).ready()).toEqual({
      status: 'ok',
      database: 'up',
    });
  });

  it('readiness answers 503 with a plain message when the database is down', async () => {
    await expect(make(false).ready()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
