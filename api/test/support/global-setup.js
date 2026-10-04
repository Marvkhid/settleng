const { spawn } = require('node:child_process');
const path = require('node:path');

module.exports = async () => {
  const child = spawn(process.execPath, [path.join(__dirname, 'start-pg.mjs')], { stdio: ['ignore', 'pipe', 'inherit'] });
  const url = await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('Postgres did not start in 90s')), 90_000);
    child.stdout.on('data', (b) => { const m = /READY (\S+)/.exec(b.toString()); if (m) { clearTimeout(t); resolve(m[1]); } });
    child.on('exit', (c) => reject(new Error(`Postgres helper exited early (${c})`)));
  });
  process.env.DATABASE_URL = url;
  process.env.DEMO_MODE = 'true';
  process.env.THROTTLE_DISABLED = 'true';
  globalThis.__PG_CHILD__ = child;
};
