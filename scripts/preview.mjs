// One command to see the real app without any credentials: `npm run preview`
// Starts the local database + API (api/scripts/dev-local.mjs) and the Next.js dev server together.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envFile = path.join(root, 'web/.env.local');
if (!fs.existsSync(envFile)) fs.writeFileSync(envFile, 'NEXT_PUBLIC_API_URL=http://localhost:4000\n');

const run = (name, cmd, args, cwd) => {
  const p = spawn(cmd, args, { cwd, stdio: 'inherit', env: process.env });
  p.on('exit', (code) => { console.log(`[${name}] stopped (${code})`); shutdown(); });
  return p;
};
const api = run('api', 'node', ['scripts/dev-local.mjs'], path.join(root, 'api'));
const web = run('web', 'npx', ['next', 'dev', '-p', '3000'], path.join(root, 'web'));
let closing = false;
function shutdown() { if (closing) return; closing = true; api.kill('SIGINT'); web.kill('SIGTERM'); setTimeout(() => process.exit(0), 1500); }
process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);
console.log('\nWhen both are ready, open http://localhost:3000\n');
