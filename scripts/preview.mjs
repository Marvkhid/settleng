// One command to see the real app without any credentials: `npm run preview`
// Starts the local database + API (api/scripts/dev-local.mjs) and the Next.js dev server together.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { killTree, run } from './lib.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envFile = path.join(root, 'web/.env.local');
if (!fs.existsSync(envFile)) fs.writeFileSync(envFile, 'NEXT_PUBLIC_API_URL=http://localhost:4000\n');

const api = run('node', ['scripts/dev-local.mjs'], { cwd: path.join(root, 'api') });
const web = run('npx', ['next', 'dev', '-p', '3000'], { cwd: path.join(root, 'web') });
let closing = false;
function shutdown() { if (closing) return; closing = true; killTree(api); killTree(web); setTimeout(() => process.exit(0), 2500); }
api.on('exit', (code) => { console.log(`[api] stopped (${code})`); shutdown(); });
web.on('exit', (code) => { console.log(`[web] stopped (${code})`); shutdown(); });
process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);
console.log('\nWhen both are ready, open http://localhost:3000   (stop with Ctrl+C)\n');
