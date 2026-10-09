// Small cross-platform helpers shared by the project scripts (Windows, macOS and Linux).
import { spawn, spawnSync } from 'node:child_process';

/** On Windows, npm/npx are .cmd files and can only be started through a shell. SETTLENG_FORCE_SHELL=1 lets us test that path anywhere. */
export const useShell = process.platform === 'win32' || process.env.SETTLENG_FORCE_SHELL === '1';

const quote = (a) => (/[\s"&|<>^]/.test(a) ? `"${String(a).replace(/"/g, '\\"')}"` : String(a));

function prepare(cmd, args, opts) {
  return useShell
    ? [[cmd, ...args].map(quote).join(' '), [], { ...opts, shell: true }]
    : [cmd, args, opts];
}

export function run(cmd, args = [], opts = {}) {
  const [c, a, o] = prepare(cmd, args, { stdio: 'inherit', ...opts });
  return spawn(c, a, o);
}

export function runSync(cmd, args = [], opts = {}) {
  const [c, a, o] = prepare(cmd, args, { stdio: 'inherit', ...opts });
  return spawnSync(c, a, o);
}

/** Stops a process AND the programs it started (a plain kill() leaves them running on Windows). */
export function killTree(child) {
  if (!child || child.exitCode !== null || !child.pid) return;
  if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
  else child.kill('SIGTERM');
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
