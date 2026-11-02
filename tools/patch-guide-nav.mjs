import { readFileSync, writeFileSync } from 'node:fs';

const edits = [
  {
    file: 'web/app/layout.tsx',
    pairs: [
      [
        'import { Analytics } from "@/components/analytics";',
        'import { Analytics } from "@/components/analytics";\nimport { GlobalLoading, NavigationLoadingBridge } from "@/components/ui/global-loading";',
      ],
      [
        '        {children}\n        <Toaster',
        '        {children}\n        <GlobalLoading />\n        <NavigationLoadingBridge />\n        <Toaster',
      ],
    ],
  },
  {
    file: 'web/lib/api-client.ts',
    pairs: [
      [
        'import { supabase } from "./supabase/client";',
        'import { beginLoading, endLoading } from "./loading";\nimport { supabase } from "./supabase/client";',
      ],
      [
        '  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);\n  try {',
        '  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);\n  beginLoading();\n  try {',
      ],
      [
        '  } finally {\n    clearTimeout(timer);\n  }',
        '  } finally {\n    clearTimeout(timer);\n    endLoading();\n  }',
      ],
    ],
  },
  {
    file: 'web/components/marketing/site-header.tsx',
    pairs: [
      [
        '  { href: "/about", label: "About" },',
        '  { href: "/guide", label: "How it works, step by step" },\n  { href: "/about", label: "About" },',
      ],
    ],
  },
  {
    file: 'web/components/shell/app-shell.tsx',
    pairs: [
      [
        '  ArrowDownLeft, ArrowUpRight, FileText, GitCompareArrows, HandCoins, Home, LineChart, LogOut, Menu, PieChart, Plus, Send, Settings, ShieldCheck, Users,',
        '  ArrowDownLeft, ArrowUpRight, BookOpen, FileText, GitCompareArrows, HandCoins, Home, LineChart, LogOut, Menu, PieChart, Plus, Send, Settings, ShieldCheck, Users,',
      ],
      [
        '  { href: "/reminders", label: "Reminders", Icon: Bell, match: (p) => p.startsWith("/reminders") },',
        '  { href: "/guide", label: "How to use SettleNG", Icon: BookOpen, match: (p) => p.startsWith("/guide") },\n  { href: "/reminders", label: "Reminders", Icon: Bell, match: (p) => p.startsWith("/reminders") },',
      ],
    ],
  },
  {
    file: 'web/app/page.tsx',
    pairs: [
      [
        '        {/* ---------- Closing CTA ---------- */}',
        `        {/* ---------- Guided tour ---------- */}
        <section aria-labelledby="guide">
          <div className="mx-auto w-full max-w-6xl px-5 pb-4 md:px-8">
            <Reveal>
              <div className="grid items-center gap-0 overflow-hidden rounded-3xl border border-line bg-surface md:grid-cols-[1fr_0.8fr]">
                <div className="p-6 md:p-9">
                  <p className="eyebrow">
                    <span aria-hidden className="h-px w-6 bg-emerald" /> New here?
                  </p>
                  <h2 id="guide" className="mt-3 text-2xl font-extrabold leading-tight md:text-3xl">
                    Want to know what SettleNG is all about?
                  </h2>
                  <p className="mt-3 max-w-md text-ink-soft">
                    Take the five-minute guided tour: what each screen does, where to find it, and the
                    four things you will do most days.
                  </p>
                  <Link href="/guide" className={cn(buttonVariants({ size: "lg" }), "mt-5")}>
                    Take the guided tour <ArrowRight className="size-5" aria-hidden />
                  </Link>
                </div>
                <div className="relative h-48 md:h-full md:min-h-[14rem]">
                  <Image
                    src="/images/cta-trader.jpg"
                    alt="A Nigerian trader smiling at her stall"
                    fill
                    sizes="(max-width: 768px) 100vw, 380px"
                    className="object-cover"
                  />
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ---------- Closing CTA ---------- */}`,
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

// Keep the sitemap honest about the new public page.
try {
  const sitemapPath = 'web/app/sitemap.ts';
  let sm = readFileSync(sitemapPath, 'utf8');
  if (!sm.includes('/guide') && sm.includes('"/about"')) {
    sm = sm.replace('"/about"', '"/guide", "/about"');
    writeFileSync(sitemapPath, sm);
    console.log('SITEMAP=patched');
  } else {
    console.log('SITEMAP=skipped');
  }
} catch {
  console.log('SITEMAP=absent');
}

console.log(failed === 0 ? 'PATCH_OK' : 'PATCH_FAIL=' + failed);
