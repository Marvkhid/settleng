import { ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { HealthController } from './health.controller';

const make = (opts: { dbUp: boolean; business: boolean }) => {
  const prisma = {
    $queryRaw: jest
      .fn()
      .mockImplementation(() =>
        opts.dbUp
          ? Promise.resolve([{ '?column?': 1 }])
          : Promise.reject(new Error('ECONNREFUSED')),
      ),
    business: {
      findUnique: jest
        .fn()
        .mockResolvedValue(opts.business ? { id: 'demo-business' } : null),
    },
  } as unknown as PrismaService;
  return new HealthController(prisma);
};

describe('HealthController', () => {
  it('liveness never touches the database', () => {
    const res = make({ dbUp: false, business: false }).check();
    expect(res.status).toBe('ok');
    expect(res.service).toBe('settleng-api');
  });

  it('readiness reports the database and whether sample data is loaded', async () => {
    expect(await make({ dbUp: true, business: true }).ready()).toEqual({
      status: 'ok',
      database: 'up',
      sampleData: 'loaded',
    });
    expect(await make({ dbUp: true, business: false }).ready()).toEqual({
      status: 'ok',
      database: 'up',
      sampleData: 'missing',
    });
  });

  it('readiness answers 503 with a plain message when the database is down', async () => {
    await expect(
      make({ dbUp: false, business: false }).ready(),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
