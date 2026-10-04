// Starts a throwaway Postgres, applies test/support/schema.sql, prints READY <url>, and runs until killed.
import EmbeddedPostgres from 'embedded-postgres';
import pg from 'pg';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'settleng-pg-'));
const port = 54000 + Math.floor(Math.random() * 900);
const server = new EmbeddedPostgres({ databaseDir: dir, user: 'postgres', password: 'test', port, persistent: false, createPostgresUser: true,
  onLog: () => {}, onError: () => {} });
await server.initialise();
await server.start();
await server.createDatabase('settleng_test');
const client = new pg.Client({ host: 'localhost', port, user: 'postgres', password: 'test', database: 'settleng_test' });
await client.connect();
await client.query(fs.readFileSync(path.join(here, 'schema.sql'), 'utf8'));
await client.end();
console.log(`READY postgresql://postgres:test@localhost:${port}/settleng_test`);
const stop = async () => { try { await server.stop(); } catch {} fs.rmSync(dir, { recursive: true, force: true }); process.exit(0); };
process.on('SIGTERM', stop); process.on('SIGINT', stop);
setInterval(() => {}, 1 << 30);
