import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DemoService } from './demo.service';
import { PrismaService } from '../prisma/prisma.service';

const make = (demoMode: string) => {
  const txMock = jest.fn().mockResolvedValue({ invoices: 25 });
  const prisma = { $transaction: txMock } as unknown as PrismaService;
  const config = { get: () => demoMode } as unknown as ConfigService;
  return { svc: new DemoService(prisma, config), txMock };
};

describe('DemoService.reset', () => {
  it('runs the restore inside one database transaction when DEMO_MODE=true', async () => {
    const { svc, txMock } = make('true');
    const res = await svc.reset();
    expect(res.status).toBe('reset');
    expect(txMock).toHaveBeenCalledTimes(1);
  });

  it('refuses to reset when DEMO_MODE is not true', async () => {
    const { svc, txMock } = make('false');
    await expect(svc.reset()).rejects.toBeInstanceOf(ForbiddenException);
    expect(txMock).not.toHaveBeenCalled();
  });
});
