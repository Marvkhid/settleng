import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BookOpen, HeartHandshake, Mail, ShieldCheck, Wallet } from "lucide-react";
import { Reveal } from "@/components/marketing/reveal";
import {
  SiteFooter,
  SUPPORT_EMAIL,
  SUPPORT_WHATSAPP,
} from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "About",
  description:
    "Why SettleNG exists: a free record-keeping tool for Nigerian traders and small business owners, built by Marvel Adeniyi.",
  alternates: { canonical: "/about" },
  openGraph: {
    title: "About SettleNG",
    description:
      "A free record book for Nigerian traders and small businesses, built by Marvel Adeniyi.",
    url: "/about",
  },
};

const PRINCIPLES = [
  {
    Icon: Wallet,
    title: "Free means free",
    body: "Sales, expenses, debts, invoices, reports and matching cost nothing. No trial, no card details, no premium tier.",
  },
  {
    Icon: ShieldCheck,
    title: "A record book, not a bank",
    body: "SettleNG never connects to your bank account, never moves money, and never takes a cut of anything you sell.",
  },
  {
    Icon: BookOpen,
    title: "Plain language",
    body: "The whole point is that a busy trader can record a sale in seconds and understand the totals without training.",
  },
  {
    Icon: HeartHandshake,
    title: "Your books stay yours",
    body: "Records are tied to your own account and can be exported as CSV whenever you want them.",
  },
];

export default function AboutPage() {
  return (
    <>
      <SiteHeader />

      <main id="main" className="flex-1">
        {/* ---------- Hero with the founder portrait ---------- */}
        <section className="relative overflow-hidden border-b border-line">
          <div
            aria-hidden
            className="pointer-events-none absolute -left-32 top-[-8rem] size-[30rem] rounded-full bg-emerald/10 blur-3xl"
          />
          <div className="relative mx-auto grid w-full max-w-6xl items-center gap-10 px-5 py-14 md:grid-cols-[1.05fr_0.95fr] md:px-8 md:py-20">
            <Reveal>
              <p className="eyebrow">
                <span aria-hidden className="h-px w-6 bg-emerald" /> About SettleNG
              </p>
              <h1 className="mt-4 text-[clamp(2.2rem,5vw,3.5rem)] font-extrabold leading-[1.05]">
                A record book for people who are too busy selling to do bookkeeping.
              </h1>
              <p className="mt-5 max-w-xl text-lg text-ink-soft">
                Most small businesses run on memory, a notebook, and whatever is in the till at
                closing time. That works until you need to answer one simple question: after the
                stock, the transport and the credit you gave out, what did this month actually make?
                SettleNG exists to make that answer easy to see.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link href="/signup" className={cn(buttonVariants({ size: "lg" }))}>
                  Start tracking for free <ArrowRight className="size-5" aria-hidden />
                </Link>
                <Link
                  href="/support"
                  className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
                >
                  Talk to us
                </Link>
              </div>
            </Reveal>

            <Reveal delay={100}>
              <figure className="mx-auto w-full max-w-sm">
                <div className="panel-dark grain relative overflow-hidden rounded-[2rem] shadow-depth">
                  <div className="relative aspect-[4/5]">
                    <Image
                      src="/images/my-dark-pic.avif"
                      alt="Marvel Adeniyi, who built SettleNG"
                      fill
                      priority
                      sizes="(max-width: 768px) 88vw, 384px"
                      className="object-cover"
                    />
                  </div>
                </div>
                <figcaption className="mt-4 text-center text-sm text-slate">
                  Marvel Adeniyi — built SettleNG after watching too many good traders guess at
                  their own numbers.
                </figcaption>
              </figure>
            </Reveal>
          </div>
        </section>

        {/* ---------- The story ---------- */}
        <section aria-labelledby="story">
          <div className="mx-auto grid w-full max-w-6xl gap-10 px-5 py-16 md:grid-cols-[1fr_1fr] md:px-8 md:py-20">
            <Reveal>
              <h2 id="story" className="text-3xl font-extrabold leading-tight md:text-[2.4rem]">
                Money comes in, money goes out — the gap is where people get lost.
              </h2>
            </Reveal>
            <Reveal delay={80}>
              <div className="space-y-4 text-lg text-ink-soft">
                <p>
                  A sale is easy to remember on the day. Ten sales a day for a month is not. Add
                  stock bought on credit, a customer who promised to pay next week, transport, rent
                  and wages, and by the end of the month the honest answer is &ldquo;I&apos;m not
                  sure&rdquo;.
                </p>
                <p>
                  Accounting software is built for people with an accountant. SettleNG is built for
                  the person behind the counter: write down what you sold and what you spent, and it
                  keeps the totals, the customer debts and the reports for you.
                </p>
                <p>
                  It is deliberately small in scope. No bank connection, no BVN, no lending, no
                  hidden fees — just your own records, kept properly.
                </p>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ---------- Principles ---------- */}
        <section aria-labelledby="principles" className="border-y border-line bg-sunken/60">
          <div className="mx-auto w-full max-w-6xl px-5 py-14 md:px-8 md:py-20">
            <Reveal>
              <p className="eyebrow">
                <span aria-hidden className="h-px w-6 bg-emerald" /> What we hold to
              </p>
              <h2 id="principles" className="mt-3 max-w-2xl text-3xl font-extrabold leading-tight">
                Four things we will not compromise on.
              </h2>
            </Reveal>
            <ul className="mt-9 grid gap-4 sm:grid-cols-2">
              {PRINCIPLES.map((p, i) => (
                <li key={p.title}>
                  <Reveal delay={i * 70} className="h-full">
                    <div className="flex h-full flex-col rounded-3xl border border-line bg-surface p-6">
                      <span className="flex size-11 items-center justify-center rounded-xl bg-emerald-wash text-emerald-ink">
                        <p.Icon className="size-5" aria-hidden />
                      </span>
                      <h3 className="mt-4 text-lg font-bold">{p.title}</h3>
                      <p className="mt-2 text-ink-soft">{p.body}</p>
                    </div>
                  </Reveal>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ---------- Contact ---------- */}
        <section aria-labelledby="contact">
          <div className="mx-auto w-full max-w-6xl px-5 py-16 md:px-8 md:py-20">
            <Reveal>
              <div className="panel-dark grain relative grid overflow-hidden rounded-[2rem] p-7 md:p-12">
                <h2 id="contact" className="max-w-xl text-3xl font-extrabold leading-tight text-white md:text-[2.4rem]">
                  A small team, and a real inbox.
                </h2>
                <p className="mt-4 max-w-xl text-lg text-white/75">
                  SettleNG is built and run by one person. If something is wrong, confusing, or
                  simply missing, write in — it gets read, and it shapes what gets built next.
                </p>
                <div className="mt-7 flex flex-wrap gap-3">
                  <a
                    href={`mailto:${SUPPORT_EMAIL}`}
                    className={cn(buttonVariants({ size: "lg" }), "bg-white text-panel hover:bg-white/90")}
                  >
                    <Mail className="size-5" aria-hidden /> {SUPPORT_EMAIL}
                  </a>
                  <a
                    href={SUPPORT_WHATSAPP}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      buttonVariants({ variant: "outline", size: "lg" }),
                      "border-white/25 bg-transparent text-white hover:bg-white/10",
                    )}
                  >
                    Message on WhatsApp
                  </a>
                </div>
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
