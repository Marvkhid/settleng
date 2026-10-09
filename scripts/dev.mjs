// `npm run dev`: API (with auto-restart) + web app together, using the database in api/.env (for example Supabase).
// No database yet? Use `npm run preview` instead: it starts a local one for you.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { killTree, run } from './lib.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envPath = path.join(root, 'api', '.env');
const hasDb = fs.existsSync(envPath) && /^\s*DATABASE_URL\s*=\s*["']?postgres/m.test(fs.readFileSync(envPath, 'utf8'));
if (!hasDb) {
  console.error(`
No database is configured for "npm run dev" yet (api/.env is missing a DATABASE_URL).

  Want to see the app right now, with no accounts?   npm run preview
  Using Supabase?  copy api/.env.example to api/.env and fill in DATABASE_URL and DIRECT_URL,
                   then run  npm run db:deploy  and  npm run db:seed  once.
`);
  process.exit(1);
}
const webEnv = path.join(root, 'web', '.env.local');
if (!fs.existsSync(webEnv)) fs.writeFileSync(webEnv, 'NEXT_PUBLIC_API_URL=http://localhost:4000\n');

const api = run('npx', ['nest', 'start', '--watch'], { cwd: path.join(root, 'api') });
const web = run('npx', ['next', 'dev', '-p', '3000'], { cwd: path.join(root, 'web') });
let closing = false;
const shutdown = () => { if (closing) return; closing = true; killTree(api); killTree(web); setTimeout(() => process.exit(0), 1500); };
api.on('exit', (c) => { console.log(`[api] stopped (${c})`); shutdown(); });
web.on('exit', (c) => { console.log(`[web] stopped (${c})`); shutdown(); });
process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);
console.log('\nStarting. When both are ready, open http://localhost:3000\n');
