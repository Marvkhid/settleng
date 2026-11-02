import { readFileSync, writeFileSync } from 'node:fs';

const edits = [
  {
    file: 'web/lib/loading.ts',
    pairs: [
      [
        'export function beginLoading(): void {',
        `/**
 * Which requests deserve the blocking overlay.
 *
 * Reads never do: dashboard loads, refreshes, polling, "me" checks and analytics all happen on
 * their own while the page stays usable. Writes do, because the person is waiting for their own
 * action to land. A caller can override either way with the explicit \`loading\` option.
 */
export function isBlockingRequest(method?: string): boolean {
  const verb = (method ?? "GET").toUpperCase();
  return verb !== "GET" && verb !== "HEAD" && verb !== "OPTIONS";
}

export function beginLoading(): void {`,
      ],
    ],
  },
  {
    file: 'web/lib/api-client.ts',
    pairs: [
      [
        'import { beginLoading, endLoading } from "./loading";',
        'import { beginLoading, endLoading, isBlockingRequest } from "./loading";',
      ],
      [
        'async function send(path: string, init?: RequestInit): Promise<Response> {',
        'async function send(\n  path: string,\n  init?: RequestInit,\n  options?: { loading?: boolean },\n): Promise<Response> {',
      ],
      [
        '  beginLoading();\n  try {',
        '  // Only user-initiated writes block the screen. Background reads stay silent.\n  const blocking = options?.loading ?? isBlockingRequest(init?.method);\n  if (blocking) beginLoading();\n  try {',
      ],
      [
        '  } finally {\n    clearTimeout(timer);\n    endLoading();\n  }',
        '  } finally {\n    clearTimeout(timer);\n    if (blocking) endLoading();\n  }',
      ],
      [
        'async function request<T>(path: string, init?: RequestInit): Promise<T> {\n  const res = await send(path, init);',
        'async function request<T>(\n  path: string,\n  init?: RequestInit,\n  options?: { loading?: boolean },\n): Promise<T> {\n  const res = await send(path, init, options);',
      ],
      [
        '    const res = await send(`/reports/export?type=${type}&from=${from}&to=${to}`);',
        '    // A CSV download is user-initiated and can take a moment, so it blocks on purpose.\n    const res = await send(`/reports/export?type=${type}&from=${from}&to=${to}`, undefined, { loading: true });',
      ],
    ],
  },
];

let failed = 0;
for (const { file, pairs } of edits) {
  let text = readFileSync(file, 'utf8');
  for (const [before, after] of pairs) {
    if (!text.includes(before)) {
      console.error(`MISSING in ${file}: ${before.split('\n')[0].slice(0, 90)}`);
      failed++;
      continue;
    }
    text = text.replace(before, after);
  }
  writeFileSync(file, text);
}
console.log(failed === 0 ? 'PATCH_OK' : 'PATCH_FAIL=' + failed);
