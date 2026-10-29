import { AlertTriangle } from "lucide-react";
import { Reveal } from "@/components/marketing/reveal";
import { SiteFooter, SUPPORT_EMAIL, SUPPORT_PHONE_DISPLAY } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";

export interface LegalSection {
  id: string;
  heading: string;
  body?: string;
  bullets?: string[];
}

/**
 * Shared shell for the privacy and terms pages. The copy it renders is written to match what the
 * application actually does; anything that depends on a decision we cannot verify (trading entity,
 * retention periods, regulator registration) is listed in `toConfirm` instead of being asserted.
 */
export function LegalPage({
  eyebrow,
  title,
  updated,
  intro,
  sections,
  toConfirm,
}: {
  eyebrow: string;
  title: string;
  updated: string;
  intro: string;
  sections: LegalSection[];
  toConfirm: string[];
}) {
  return (
    <>
      <SiteHeader />
      <main id="main" className="flex-1">
        <section className="border-b border-line bg-sunken/60">
          <div className="mx-auto w-full max-w-4xl px-5 py-12 md:px-8 md:py-16">
            <p className="eyebrow">
              <span aria-hidden className="h-px w-6 bg-emerald" /> {eyebrow}
            </p>
            <h1 className="mt-4 text-[clamp(2.1rem,4.6vw,3rem)] font-extrabold leading-tight">
              {title}
            </h1>
            <p className="mt-3 text-sm text-slate">Last updated: {updated}</p>
            <p className="mt-5 max-w-2xl text-lg text-ink-soft">{intro}</p>
          </div>
        </section>

        <div className="mx-auto grid w-full max-w-4xl gap-10 px-5 py-12 md:px-8 md:py-16">
          <nav aria-label="On this page" className="rounded-2xl border border-line bg-surface p-5">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate">On this page</p>
            <ol className="mt-3 grid gap-1.5 text-sm sm:grid-cols-2">
              {sections.map((s, i) => (
                <li key={s.id}>
                  <a href={`#${s.id}`} className="link-underline text-ink-soft hover:text-emerald-ink">
                    {i + 1}. {s.heading}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          {sections.map((s, i) => (
            <Reveal key={s.id}>
              <section id={s.id} aria-labelledby={`${s.id}-h`} className="scroll-mt-24">
                <h2 id={`${s.id}-h`} className="text-xl font-extrabold md:text-2xl">
                  {i + 1}. {s.heading}
                </h2>
                {s.body && (
                  <p className="mt-3 whitespace-pre-line leading-relaxed text-ink-soft">{s.body}</p>
                )}
                {s.bullets && (
                  <ul className="mt-3 space-y-2">
                    {s.bullets.map((b) => (
                      <li key={b} className="flex gap-2.5 leading-relaxed text-ink-soft">
                        <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-emerald" />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </Reveal>
          ))}

          <div className="rounded-2xl border border-gold/30 bg-gold-wash p-5">
            <p className="flex items-center gap-2 font-bold text-gold">
              <AlertTriangle className="size-5" aria-hidden /> Details that need confirmation before launch
            </p>
            <p className="mt-2 text-sm text-ink-soft">
              We wrote this page to match what the application actually does. The items below depend
              on decisions only the business owner can make, so they are stated as open rather than
              invented.
            </p>
            <ul className="mt-3 space-y-1.5">
              {toConfirm.map((t) => (
                <li key={t} className="flex gap-2 text-sm text-ink-soft">
                  <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-gold" />
                  {t}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-line bg-surface p-5">
            <p className="font-bold">Questions about this page?</p>
            <p className="mt-2 text-sm text-ink-soft">
              Email{" "}
              <a href={`mailto:${SUPPORT_EMAIL}`} className="link-underline font-semibold text-emerald-ink">
                {SUPPORT_EMAIL}
              </a>{" "}
              or call{" "}
              <a href="tel:+2348107387326" className="link-underline font-semibold text-emerald-ink">
                {SUPPORT_PHONE_DISPLAY}
              </a>
              . More ways to reach us are on the support page.
            </p>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
