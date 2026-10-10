// Starts a throwaway Postgres, applies the committed Prisma migrations, prints READY <url>, and runs until killed.
import EmbeddedPostgres from 'embedded-postgres';
import pg from 'pg';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '../..');
// Applies every committed migration (prisma/migrations/*/migration.sql) in order: the same SQL `prisma migrate deploy` runs.
const migrationsDir = path.join(ROOT, 'prisma/migrations');
const migrationSql = () => fs.readdirSync(migrationsDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort()
  .map((n) => fs.readFileSync(path.join(migrationsDir, n, 'migration.sql'), 'utf8')).join('\n');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'settleng-pg-'));
const port = 54000 + Math.floor(Math.random() * 900);
const server = new EmbeddedPostgres({ databaseDir: dir, user: 'postgres', password: 'test', port, persistent: false, createPostgresUser: process.platform !== 'win32',
  initdbFlags: ['--encoding=UTF8', '--lc-collate=C', '--lc-ctype=C'],
  onLog: () => {}, onError: () => {} });
await server.initialise();
await server.start();
await server.createDatabase('settleng_test');
const client = new pg.Client({ host: 'localhost', port, user: 'postgres', password: 'test', database: 'settleng_test' });
await client.connect();
await client.query(migrationSql());
await client.end();
console.log(`READY postgresql://postgres:test@localhost:${port}/settleng_test`);
const stop = async () => { try { await server.stop(); } catch {} fs.rmSync(dir, { recursive: true, force: true }); process.exit(0); };
process.on('SIGTERM', stop); process.on('SIGINT', stop);
setInterval(() => {}, 1 << 30);
