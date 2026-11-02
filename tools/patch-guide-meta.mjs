import { readFileSync, writeFileSync } from 'node:fs';

const edits = [
  {
    file: 'web/lib/site.ts',
    pairs: [
      [
        '  { path: "/about", priority: 0.7, changeFrequency: "monthly" },',
        '  { path: "/guide", priority: 0.8, changeFrequency: "monthly" },\n  { path: "/about", priority: 0.7, changeFrequency: "monthly" },',
      ],
    ],
  },
  {
    file: 'web/components/marketing/site-header.tsx',
    pairs: [
      ['  { href: "/guide", label: "How it works, step by step" },', '  { href: "/guide", label: "Guide" },'],
    ],
  },
  {
    file: 'render.yaml',
    pairs: [
      [
        '      - key: CORS_ORIGIN      # your website URL, for example https://settleng.vercel.app\n        sync: false',
        `      - key: CORS_ORIGIN      # your website URL, for example https://settleng.vercel.app
        sync: false
      - key: APP_URL          # public site URL used in reminder email links, e.g. https://settleng.vercel.app
        sync: false
      - key: CRON_SECRET      # openssl rand -hex 32; the cron job sends this as x-cron-secret
        sync: false
      - key: RESEND_API_KEY   # https://resend.com/api-keys - server-side only, never in the web app
        sync: false
      - key: RESEND_FROM      # optional, defaults to the verified sender configured in the API
        sync: false`,
      ],
    ],
  },
];

let failed = 0;
for (const { file, pairs } of edits) {
  let text = readFileSync(file, 'utf8');
  for (const [before, after] of pairs) {
    if (!text.includes(before)) {
      console.error(`MISSING in ${file}: ${before.split('\n')[0].slice(0, 80)}`);
      failed++;
      continue;
    }
    text = text.replace(before, after);
  }
  writeFileSync(file, text);
}
console.log(failed === 0 ? 'PATCH_OK' : 'PATCH_FAIL=' + failed);
