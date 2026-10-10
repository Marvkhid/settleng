// Checks that this machine and folder are ready to run SettleNG, and says what to do about anything that is not.
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { useShell } from './lib.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let blockers = 0;
const ok = (m) => console.log(`  \u2713 ${m}`);
const warn = (m, fix) => { console.log(`  ! ${m}${fix ? `\n      -> ${fix}` : ''}`); };
const bad = (m, fix) => { blockers++; console.log(`  \u2717 ${m}${fix ? `\n      -> ${fix}` : ''}`); };
const exists = (...p) => fs.existsSync(path.join(root, ...p));

console.log('\nSettleNG doctor\n');

const major = Number(process.versions.node.split('.')[0]);
major >= 20 ? ok(`Node ${process.versions.node}`) : bad(`Node ${process.versions.node} is too old`, 'Install Node 20 or newer from https://nodejs.org (the LTS version).');
const npmV = spawnSync(useShell ? 'npm -v' : 'npm', useShell ? [] : ['-v'], { shell: useShell, encoding: 'utf8' });
npmV.status === 0 ? ok(`npm ${npmV.stdout.trim()}`) : bad('npm was not found', 'Reinstall Node.js, which includes npm.');

const lower = root.toLowerCase();
if (/onedrive/.test(lower)) warn('This folder is inside OneDrive.', 'OneDrive locks files while syncing node_modules (thousands of files) and causes EPERM errors. Move the project to C:\\dev\\settleng.');
else if (process.platform === 'win32' && /\\(desktop|documents)\\/.test(lower + '\\')) warn('This folder is on Desktop/Documents, which OneDrive often syncs.', 'If installs fail with EPERM, move the project to C:\\dev\\settleng.');
else ok('Folder location looks fine');

for (const [name, bin] of [['api', 'nest'], ['web', 'next']]) {
  const hasBin = exists(name, 'node_modules', '.bin', bin) || exists(name, 'node_modules', '.bin', `${bin}.cmd`);
  hasBin ? ok(`${name} dependencies installed`) : bad(`${name} dependencies are missing or incomplete`, 'Run: npm run install:all   (after a failed install use: npm run install:all -- --clean)');
}
exists('api', 'src', 'generated', 'prisma', 'client.ts')
  ? ok('Database client generated')
  : bad('Database client has not been generated', 'Run: npm run install:all   (it runs "prisma generate" automatically) or: npm run generate --prefix api');
exists('api', 'prisma', 'migrations') ? ok('Database migration present') : bad('prisma/migrations is missing', 'Re-extract the project zip.');

const free = (port) => new Promise((resolve) => { const s = net.createServer(); s.once('error', () => resolve(false)); s.once('listening', () => s.close(() => resolve(true))); s.listen(port); });
for (const [port, what] of [[3000, 'web app'], [4000, 'API'], [54320, 'local database']]) {
  (await free(port)) ? ok(`Port ${port} is free (${what})`) : warn(`Port ${port} is already in use (${what})`, 'Another copy may be running. Close it, or stop the program using that port.');
}

console.log('');
exists('api', '.env') ? ok('api/.env found (used by npm run dev)') : console.log('  - api/.env not created yet. Needed for npm run dev with Supabase. Copy api/.env.example to api/.env.');
console.log(`  - ${os.platform()} ${os.release()}`);
console.log(blockers ? `\n${blockers} problem(s) to fix above.\n` : '\nEverything needed is in place. Try:  npm run dev\n');
process.exit(blockers ? 1 : 0);
