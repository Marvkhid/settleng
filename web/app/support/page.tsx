import type { Metadata } from "next";
import Link from "next/link";
import { Clock, Mail, MessageCircle, Phone, ShieldQuestion } from "lucide-react";
import { ComplaintForm } from "@/components/marketing/complaint-form";
import { Reveal } from "@/components/marketing/reveal";
import {
  SiteFooter,
  SUPPORT_EMAIL,
  SUPPORT_PHONE_DISPLAY,
  SUPPORT_PHONE_TEL,
  SUPPORT_WHATSAPP,
} from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";

export const metadata: Metadata = {
  title: "Support & complaints",
  description:
    "Contact SettleNG about your account, a record, or anything that is not working. Email, phone and WhatsApp support.",
};

const CHANNELS = [
  {
    Icon: Mail,
    label: "Email",
    value: SUPPORT_EMAIL,
    href: `mailto:${SUPPORT_EMAIL}`,
    note: "Best for anything with details — attach screenshots if you have them.",
  },
  {
    Icon: Phone,
    label: "Phone",
    value: SUPPORT_PHONE_DISPLAY,
    href: `tel:${SUPPORT_PHONE_TEL}`,
    note: "Call during normal business hours.",
  },
  {
    Icon: MessageCircle,
    label: "WhatsApp",
    value: "Message us",
    href: SUPPORT_WHATSAPP,
    note: "Quickest for short questions about your account.",
  },
];

export default function SupportPage() {
  return (
    <>
      <SiteHeader />

      <main id="main" className="flex-1">
        <section className="relative overflow-hidden border-b border-line">
          <div
            aria-hidden
            className="pointer-events-none absolute -left-24 top-[-6rem] size-[26rem] rounded-full bg-sky/10 blur-3xl"
          />
          <div className="relative mx-auto w-full max-w-6xl px-5 py-14 md:px-8 md:py-20">
            <Reveal>
              <p className="eyebrow">
                <span aria-hidden className="h-px w-6 bg-emerald" /> Contact &amp; support
              </p>
              <h1 className="mt-4 max-w-3xl text-[clamp(2.2rem,5vw,3.4rem)] font-extrabold leading-[1.06]">
                Something not right? Tell us, and we&apos;ll look at it.
              </h1>
              <p className="mt-5 max-w-2xl text-lg text-ink-soft">
                Whether it&apos;s a password you can&apos;t reset, a sale that looks wrong, or a page
                that won&apos;t load — reach us on any of the channels below. A real person reads
                them.
              </p>
            </Reveal>

            <div className="mt-9 grid gap-4 sm:grid-cols-3">
              {CHANNELS.map((c, i) => (
                <Reveal key={c.label} delay={i * 70}>
                  <a
                    href={c.href}
                    {...(c.href.startsWith("http")
                      ? { target: "_blank", rel: "noopener noreferrer" }
                      : {})}
                    className="flex h-full flex-col rounded-3xl border border-line bg-surface p-5 transition-all hover:-translate-y-0.5 hover:border-emerald/35 hover:shadow-depth"
                  >
                    <span className="flex size-10 items-center justify-center rounded-xl bg-emerald-wash text-emerald-ink">
                      <c.Icon className="size-5" aria-hidden />
                    </span>
                    <p className="mt-4 text-xs font-bold uppercase tracking-[0.14em] text-slate">
                      {c.label}
                    </p>
                    <p className="mt-1 break-words text-lg font-bold">{c.value}</p>
                    <p className="mt-2 text-sm text-slate">{c.note}</p>
                  </a>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section
          id="complaints"
          aria-labelledby="complaints-h"
          className="mx-auto w-full max-w-6xl scroll-mt-24 px-5 py-16 md:px-8 md:py-20"
        >
          <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-14">
            <Reveal>
              <p className="eyebrow">
                <span aria-hidden className="h-px w-6 bg-emerald" /> Complaints &amp; feedback
              </p>
              <h2 id="complaints-h" className="mt-3 text-3xl font-extrabold leading-tight md:text-[2.3rem]">
                Write it once, send it properly
              </h2>
              <p className="mt-4 text-ink-soft">
                Fill this in and we&apos;ll format the message for you. Nothing is submitted from this
                page — it opens your email app or WhatsApp with the details filled in, so you always
                see exactly what is being sent and to whom.
              </p>

              <div className="mt-6 space-y-4 rounded-2xl border border-line bg-sunken/60 p-5">
                <p className="flex gap-2.5 text-sm text-ink-soft">
                  <Clock className="mt-0.5 size-4 shrink-0 text-slate" aria-hidden />
                  We reply by email or phone. Including the address you signed up with helps us find
                  your record quickly.
                </p>
                <p className="flex gap-2.5 text-sm text-ink-soft">
                  <ShieldQuestion className="mt-0.5 size-4 shrink-0 text-slate" aria-hidden />
                  Never send your password, full card number or bank credentials. We will never ask
                  for them.
                </p>
              </div>

              <p className="mt-5 text-sm text-slate">
                Prefer not to use a form?{" "}
                <a href={`mailto:${SUPPORT_EMAIL}`} className="link-underline font-semibold text-emerald-ink">
                  Email {SUPPORT_EMAIL}
                </a>{" "}
                or call{" "}
                <a href={`tel:${SUPPORT_PHONE_TEL}`} className="link-underline font-semibold text-emerald-ink">
                  {SUPPORT_PHONE_DISPLAY}
                </a>
                .
              </p>
            </Reveal>

            <Reveal delay={90}>
              <div className="rounded-3xl border border-line bg-surface p-5 md:p-7">
                <ComplaintForm />
              </div>
            </Reveal>
          </div>
        </section>

        <section className="border-y border-line bg-sunken/70">
          <div className="mx-auto w-full max-w-6xl px-5 py-14 md:px-8 md:py-16">
            <Reveal>
              <h2 className="text-2xl font-extrabold md:text-3xl">Common questions</h2>
            </Reveal>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {[
                {
                  q: "I can't sign in",
                  a: "Use “Forgot password” on the login page to get a reset link. If the email does not arrive, check spam, then message us with the address you signed up with.",
                },
                {
                  q: "A sale I recorded looks wrong",
                  a: "Open Sales, find the record and check the amount, date and payment method. If it still looks wrong, tell us the date and amount so we can look at it.",
                },
                {
                  q: "Where is my data kept?",
                  a: "Your records are stored in a PostgreSQL database tied to your account, and the site is served over HTTPS. The privacy policy explains this in full.",
                },
                {
                  q: "Can I get my records out?",
                  a: "Yes — reports can be downloaded as CSV from the Reports page while you are signed in.",
                },
              ].map((f, i) => (
                <Reveal key={f.q} delay={i * 60}>
                  <div className="h-full rounded-2xl border border-line bg-surface p-5">
                    <h3 className="font-bold">{f.q}</h3>
                    <p className="mt-2 text-sm text-ink-soft">{f.a}</p>
                  </div>
                </Reveal>
              ))}
            </div>
            <p className="mt-6 text-sm text-slate">
              More detail is in our{" "}
              <Link href="/privacy" className="link-underline font-semibold text-emerald-ink">
                Privacy Policy
              </Link>{" "}
              and{" "}
              <Link href="/terms" className="link-underline font-semibold text-emerald-ink">
                Terms of Service
              </Link>
              .
            </p>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
