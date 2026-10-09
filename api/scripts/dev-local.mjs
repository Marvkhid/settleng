// Local preview with NO external database: a real Postgres in ./.local-pg + the sample business + the API.
// Data persists between runs. Delete api/.local-pg to start over. Stop with Ctrl+C.
import EmbeddedPostgres from 'embedded-postgres';
import pg from 'pg';
import { killTree, run, runSync } from '../../scripts/lib.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = root;
// Applies every committed migration (prisma/migrations/*/migration.sql) in order: the same SQL `prisma migrate deploy` runs.
const migrationsDir = path.join(ROOT, 'prisma/migrations');
const migrationSql = () => fs.readdirSync(migrationsDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort()
  .map((n) => fs.readFileSync(path.join(migrationsDir, n, 'migration.sql'), 'utf8')).join('\n');

const dir = path.join(root, '.local-pg');
const port = 54320;
const fresh = !fs.existsSync(dir);
const server = new EmbeddedPostgres({
  databaseDir: dir, user: 'postgres', password: 'local', port, persistent: true,
  createPostgresUser: process.getuid?.() === 0, onLog: () => {}, onError: () => {},
});

console.log(fresh ? 'Setting up a local database (first run only)...' : 'Starting local database...');
if (fresh) await server.initialise();
await server.start();
const url = `postgresql://postgres:local@localhost:${port}/settleng_local`;
const env = { ...process.env, DATABASE_URL: url, DIRECT_URL: url, DEMO_MODE: 'true', PORT: process.env.PORT ?? '4000', CORS_ORIGIN: process.env.CORS_ORIGIN ?? 'http://localhost:3000' };

if (fresh) {
  await server.createDatabase('settleng_local');
  const c = new pg.Client({ host: 'localhost', port, user: 'postgres', password: 'local', database: 'settleng_local' });
  await c.connect();
  await c.query(migrationSql());
  await c.end();
  console.log('Loading the sample business (Adeola Mini Mart)...');
  const seeded = runSync('npx', ['tsx', 'prisma/seed.ts'], { cwd: root, env });
  if (seeded.status !== 0) { await server.stop(); process.exit(1); }
}

console.log(`\nAPI starting on http://localhost:${env.PORT}  (docs: /api/docs)\n`);
const api = run('npx', ['nest', 'start', '--watch'], { cwd: root, env });
let stopping = false;
const stop = async () => { if (stopping) return; stopping = true; killTree(api); try { await server.stop(); } catch { /* already stopped */ } process.exit(0); };
process.on('SIGINT', stop); process.on('SIGTERM', stop);
api.on('exit', stop);
