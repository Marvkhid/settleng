// Installs the api and web dependencies. Retries on flaky connections (ECONNRESET) and can clean a half-finished install.
//   npm run install:all            normal
//   npm run install:all -- --clean delete node_modules first (use after a failed or interrupted install)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runSync, sleep } from './lib.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const clean = process.argv.includes('--clean');
const ATTEMPTS = 4;
const WAIT_UNIT = Number(process.env.SETTLENG_RETRY_UNIT_SECONDS ?? 8);

function removeNodeModules(dir) {
  const target = path.join(dir, 'node_modules');
  if (!fs.existsSync(target)) return true;
  try {
    // Windows often holds files briefly (antivirus, OneDrive, editors), so retry.
    fs.rmSync(target, { recursive: true, force: true, maxRetries: 8, retryDelay: 500 });
    return true;
  } catch (e) {
    console.error(`\n  Could not delete ${target}: ${e.code ?? e.message}`);
    console.error('  Close editors/terminals using this folder, pause OneDrive sync, then run this again.\n');
    return false;
  }
}

let failed = null;
for (const name of ['api', 'web']) {
  const dir = path.join(root, name);
  if (clean && !removeNodeModules(dir)) { failed = name; break; }
  let ok = false;
  for (let attempt = 1; attempt <= ATTEMPTS && !ok; attempt++) {
    console.log(`\n=== Installing ${name} (attempt ${attempt} of ${ATTEMPTS}) ===`);
    ok = runSync('npm', ['install', '--no-fund', '--no-audit'], { cwd: dir }).status === 0;
    if (!ok && attempt < ATTEMPTS) { const wait = attempt * WAIT_UNIT; console.log(`\nInstall of ${name} failed. This is usually the network. Retrying in ${wait}s...`); await sleep(wait * 1000); }
  }
  if (!ok) { failed = name; break; }
}

if (failed) {
  console.error(`
Installing "${failed}" did not finish. What usually fixes it:
  1. Check your internet connection, turn off any VPN/proxy, or switch network (a phone hotspot works), then run again.
  2. If you saw EPERM / "operation not permitted": Windows had files locked. Close VS Code and other terminals,
     pause OneDrive, and move the project out of Desktop/Documents (for example C:\\dev\\settleng).
  3. Start from a clean slate:   npm run install:all -- --clean
  4. Run   npm run doctor   to see exactly what is missing.
More help: docs/TROUBLESHOOTING.md`);
  process.exit(1);
}
console.log('\nAll dependencies installed.\n\nNext:\n  npm run doctor    check everything is in place\n  npm run dev       run the API + web app (needs api/.env)\n');
