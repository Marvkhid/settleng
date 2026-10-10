import EmbeddedPostgres from 'embedded-postgres';
import pg from 'pg';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '../..');
const migrationsDir = path.join(ROOT, 'prisma/migrations');
const migrationSql = () =>
  fs
    .readdirSync(migrationsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort()
    .map((n) => fs.readFileSync(path.join(migrationsDir, n, 'migration.sql'), 'utf8'))
    .join('\n');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'settleng-pg-'));
const port = 54130 + Math.floor(Math.random() * 900);
console.error(`dir=${dir} port=${port}`);

const server = new EmbeddedPostgres({
  databaseDir: dir,
  user: 'postgres',
  password: 'test',
  port,
  persistent: false,
  createPostgresUser: false,
  onLog: (m) => console.error('[pg-log]', m),
  onError: (m) => console.error('[pg-err]', m),
});

await server.initialise();
console.error('initialised');
await server.start();
console.error('started');
await server.createDatabase('settleng_test');
console.error('db created');

const client = new pg.Client({
  host: 'localhost',
  port,
  user: 'postgres',
  password: 'test',
  database: 'settleng_test',
});
await client.connect();
console.error('client connected');
await client.query(migrationSql());
console.error('migrations applied');
await client.end();
console.error('client ended');

console.log(`READY postgresql://postgres:test@localhost:${port}/settleng_test`);

const stop = async () => {
  try { await server.stop(); } catch {}
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
  process.exit(0);
};
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
setInterval(() => {}, 1 << 30);
