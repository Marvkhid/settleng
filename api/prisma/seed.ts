import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { applySeed, todayUtc } from '../src/seed/apply-seed';

async function main() {
  const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!url) throw new Error('Set DATABASE_URL (or DIRECT_URL) before seeding');
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  try {
    const counts = await prisma.$transaction((tx) => applySeed(tx, todayUtc()), { timeout: 60_000, maxWait: 20_000 });
    console.log('Seeded demo business:', counts);
  } finally {
    await prisma.$disconnect();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
