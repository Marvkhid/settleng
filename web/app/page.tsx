import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronRight,
  FileText,
  GitCompareArrows,
  LineChart,
  Lock,
  ReceiptText,
  ShieldCheck,
  Users,
  Wallet,
} from "lucide-react";
import { Reveal } from "@/components/marketing/reveal";
import { SiteFooter } from "@/components/marketing/site-footer";
import { StructuredData } from "@/components/marketing/structured-data";
import { SiteHeader } from "@/components/marketing/site-header";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "SettleNG — Know where your money goes",
  description:
    "SettleNG is a free money tracker for Nigerian traders and small business owners: record sales and expenses, track customer debts, and see how your business is moving.",
  alternates: { canonical: "/" },
};

const FEATURES = [
  {
    Icon: Wallet,
    title: "Record every sale",
    body: "Cash, bank transfer, POS or on credit — write it down in a few taps, right when it happens.",
  },
  {
    Icon: ReceiptText,
    title: "Track expenses",
    body: "Stock, transport, rent, wages. See what leaves the business so you know what is actually left.",
  },
  {
    Icon: Users,
    title: "Know who owes you",
    body: "Every customer's unpaid balance in one list, with how long it has been outstanding.",
  },
  {
    Icon: FileText,
    title: "Send invoices",
    body: "Create an invoice with items, record part payments as they come in, and follow what is still open.",
  },
  {
    Icon: LineChart,
    title: "See the trend",
    body: "Revenue, expenses and profit over 7 days to a year — with a plain-English summary of what it means.",
  },
  {
    Icon: GitCompareArrows,
    title: "Match records",
    body: "Bring in a bank statement CSV, review the rows, and link payments to the right customer.",
  },
];

const STEPS = [
  {
    n: "01",
    title: "Create your account",
    body: "Sign up with your email and give your business a name. It takes under a minute and costs nothing.",
  },
  {
    n: "02",
    title: "Record as you go",
    body: "Each sale, each expense. From your phone, the moment it happens — not at the end of a long day.",
  },
  {
    n: "03",
    title: "Read your numbers",
    body: "Open your dashboard to see today's takings, who still owes you, and how the month is trending.",
  },
];

const AUDIENCE = [
  {
    img: "/images/case-tailor.jpg",
    alt: "A tailor in his shop, sitting at a sewing machine with patterned fabric on the table",
    label: "Tailors & designers",
    body: "Fabric bought, jobs delivered, balance still owed by a customer.",
  },
  {
    img: "/images/case-shop.jpg",
    alt: "A provisions seller sitting in front of baskets, sacks of sugar and stacked drinks in a Nigerian market",
    label: "Shops & provisions",
    body: "Daily takings, restocking, and credit given to regular customers.",
  },
  {
    img: "/images/case-food.jpg",
    alt: "A street food vendor at his stall in Kaduna, Nigeria",
    label: "Food & produce",
    body: "Market days that are busy and quiet, and costs that change with them.",
  },
];

/** A labelled illustration of the dashboard layout — sample figures, never real user data. */
function SampleDashboard() {
  const rows = [
    { label: "Sold goods", sub: "Today · Cash", amount: "+₦5,000", up: true },
    { label: "Bought stock", sub: "Today · Transport", amount: "−₦8,000", up: false },
    { label: "Customer payment", sub: "Yesterday · Transfer", amount: "+₦10,000", up: true },
  ];
  return (
    <figure className="relative">
      <div className="panel-dark overflow-hidden rounded-3xl shadow-depth">
        <div className="flex items-center justify-between gap-3 border-b border-white/12 px-5 py-3">
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-white/55">
            Sample dashboard
          </span>
          <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-white/70">
            Example numbers
          </span>
        </div>
        <div className="px-5 pb-5 pt-5">
          <p className="text-sm font-semibold text-white/70">Sales today</p>
          <p className="figure mt-1 text-[clamp(2.4rem,7vw,3.6rem)] font-extrabold leading-none">
            ₦48,500
          </p>
          <div className="mt-5 grid grid-cols-3 divide-x divide-white/12 rounded-2xl bg-black/25">
            {[
              ["Spent", "₦12,000"],
              ["Money in", "₦41,500"],
              ["Money out", "₦12,000"],
            ].map(([k, v]) => (
              <div key={k} className="px-3 py-3">
                <p className="text-[11px] text-white/55">{k}</p>
                <p className="figure mt-0.5 text-sm font-bold">{v}</p>
              </div>
            ))}
          </div>
        </div>
        <ul className="space-y-px bg-white/5 px-3 pb-3">
          {rows.map((r) => (
            <li key={r.label} className="flex items-center gap-3 rounded-xl px-2 py-2.5">
              <span
                aria-hidden
                className={cn(
                  "flex size-8 items-center justify-center rounded-full",
                  r.up ? "bg-emerald/20 text-emerald" : "bg-white/10 text-white/60",
                )}
              >
                {r.up ? <ArrowDownLeftMini /> : <ArrowUpRight className="size-4" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-white">{r.label}</span>
                <span className="block truncate text-[11px] text-white/50">{r.sub}</span>
              </span>
              <span className={cn("figure tnum text-sm font-bold", r.up ? "text-emerald" : "text-white/80")}>
                {r.amount}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <figcaption className="mt-3 text-center text-xs text-slate">
        The real dashboard shows only what you have recorded — this is a sample layout.
      </figcaption>
    </figure>
  );
}

function ArrowDownLeftMini() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
      <path d="M17 7 7 17M7 17h7M7 17v-7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default async function LandingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Supabase can send a failed email confirmation straight to the Site URL. Rather than letting
  // someone land on a silent homepage, explain it and send them to the resend flow.
  const params = await searchParams;
  const linkError =
    typeof params.error_code === "string"
      ? params.error_code
      : typeof params.error === "string"
        ? params.error
        : null;

  return (
    <>
      {/* Skip link lives in the root layout so every page has one. */}
      <StructuredData />
      <SiteHeader />

      <main id="main" className="flex-1">
        {linkError && (
          <div className="mx-auto w-full max-w-6xl px-5 pt-6 md:px-8">
            <div role="alert" className="rounded-2xl border border-red-200 bg-red-wash p-4 text-ink">
              <p className="font-semibold text-red">
                That email link has expired, or it was already used once.
              </p>
              <p className="mt-1 text-sm text-ink-soft">
                Confirmation links only work a single time. Log in with your email and password —
                you can request a fresh confirmation link there if your account still needs one.
              </p>
              <Link
                href={`/login?authError=${encodeURIComponent(linkError)}`}
                className="mt-3 inline-flex min-h-11 items-center rounded-xl bg-emerald-ink px-4 font-semibold text-white hover:bg-emerald-deep"
              >
                Go to log in
              </Link>
            </div>
          </div>
        )}

        {/* ---------- Hero ---------- */}
        <section className="relative overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute -left-40 top-[-10rem] size-[32rem] rounded-full bg-emerald/10 blur-3xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -right-32 top-24 size-[26rem] rounded-full bg-sky/10 blur-3xl"
          />
          <div className="relative mx-auto grid w-full max-w-6xl items-center gap-12 px-5 pb-16 pt-10 md:px-8 md:pb-24 md:pt-16 lg:grid-cols-[1.02fr_0.98fr] lg:gap-16">
            <div>
              <Reveal>
                <p className="inline-flex items-center gap-2 rounded-full border border-emerald/25 bg-emerald-wash px-3.5 py-1.5 text-sm font-semibold text-emerald-ink">
                  <span aria-hidden className="size-2 rounded-full bg-emerald" />
                  Free money tracking for Nigerian businesses
                </p>
              </Reveal>

              <Reveal delay={80}>
                <h1 className="mt-5 text-[clamp(2.4rem,5.6vw,4rem)] font-extrabold leading-[1.04] text-ink">
                  Know where your <span className="text-emerald-ink">money</span> goes. See where
                  your business is going.
                </h1>
              </Reveal>

              <Reveal delay={140}>
                <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-soft md:text-xl">
                  SettleNG helps traders, shop owners and small business operators record sales and
                  expenses, track what customers owe, and understand how the business is moving — all
                  in one simple place.
                </p>
              </Reveal>

              <Reveal delay={200}>
                <div className="mt-8 flex flex-wrap items-center gap-3">
                  <Link href="/signup" className={cn(buttonVariants({ size: "lg" }), "shadow-glow")}>
                    Start tracking for free <ArrowRight className="size-5" aria-hidden />
                  </Link>
                  <Link
                    href="#how-it-works"
                    className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
                  >
                    See how it works
                  </Link>
                </div>
                <p className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate">
                  <span className="inline-flex items-center gap-1.5">
                    <Check className="size-4 text-emerald" aria-hidden /> Free to use, no subscription
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Check className="size-4 text-emerald" aria-hidden /> No bank login needed
                  </span>
                </p>
              </Reveal>
            </div>

            {/* Layered photography + a real-looking dashboard sample */}
            <Reveal delay={160} className="relative">
              <figure>
                <div className="frame-photo grain relative aspect-[4/5] w-full sm:aspect-square lg:aspect-[4/4.7]">
                  <Image
                    src="/images/hero-market.jpg"
                    alt="A trader at a busy Lagos market arranging tomatoes and peppers beside a row of yellow buses"
                    fill
                    priority
                    sizes="(max-width: 640px) 92vw, (max-width: 1024px) 88vw, 540px"
                    className="object-cover object-[68%_center]"
                  />
                  <div
                    aria-hidden
                    className="absolute inset-0 bg-gradient-to-t from-panel/80 via-panel/15 to-transparent"
                  />
                  <div className="absolute inset-x-4 bottom-4 sm:inset-x-6 sm:bottom-6">
                    <p className="font-display text-lg font-bold text-white sm:text-xl">
                      Built for the market, the shop and the stall.
                    </p>
                  </div>
                  <div className="absolute right-3 top-3 rounded-xl border border-white/20 bg-panel/70 px-2.5 py-1.5 backdrop-blur sm:right-4 sm:top-4">
                    <p className="flex items-center gap-1.5 text-[11px] font-semibold text-white">
                      <Lock className="size-3.5" aria-hidden /> Private to you
                    </p>
                  </div>
                </div>
              </figure>
            </Reveal>
          </div>
        </section>

        {/* ---------- The problem ---------- */}
        <section aria-labelledby="problem" className="border-y border-line bg-sunken/70">
          <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-5 py-16 md:px-8 md:py-24 lg:grid-cols-[0.95fr_1.05fr] lg:gap-16">
            <Reveal className="order-2 lg:order-1">
              <div className="frame-photo grain aspect-[4/3] w-full">
                <Image
                  src="/images/story-street.jpg"
                  alt="A young trader carrying a sack of groundnuts through a busy northern Nigerian market street"
                  fill
                  sizes="(max-width: 1024px) 92vw, 520px"
                  className="object-cover"
                />
              </div>
            </Reveal>

            <div className="order-1 lg:order-2">
              <Reveal>
                <p className="eyebrow">
                  <span aria-hidden className="h-px w-6 bg-emerald" /> The everyday problem
                </p>
                <h2
                  id="problem"
                  className="mt-3 text-3xl font-extrabold leading-tight md:text-[2.6rem]"
                >
                  Money moves all day. The record is what goes missing.
                </h2>
              </Reveal>
              <Reveal delay={80}>
                <p className="mt-4 text-lg text-ink-soft">
                  A busy day can mean dozens of small sales, a restock, transport, and credit given
                  to a regular customer. By evening, the details blur — and the notebook is somewhere
                  under the counter.
                </p>
                <ul className="mt-6 space-y-3">
                  {[
                    "Sales remembered roughly, not exactly.",
                    "Expenses that never get written down at all.",
                    "Customers who still owe you, forgotten until it is awkward.",
                    "No clear way to tell whether this month is better than the last.",
                  ].map((line) => (
                    <li key={line} className="flex gap-3 text-ink-soft">
                      <span
                        aria-hidden
                        className="mt-2 size-1.5 shrink-0 rounded-full bg-clay"
                      />
                      {line}
                    </li>
                  ))}
                </ul>
              </Reveal>
            </div>
          </div>
        </section>

        {/* ---------- What it does ---------- */}
        <section aria-labelledby="features" id="features" className="scroll-mt-24">
          <div className="mx-auto w-full max-w-6xl px-5 py-16 md:px-8 md:py-24">
            <Reveal>
              <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="eyebrow">
                    <span aria-hidden className="h-px w-6 bg-emerald" /> What SettleNG does
                  </p>
                  <h2 id="features" className="mt-3 max-w-2xl text-3xl font-extrabold leading-tight md:text-[2.6rem]">
                    Everything a busy business needs. Nothing an accountant would.
                  </h2>
                </div>
                <p className="max-w-sm text-ink-soft">
                  Six working parts, not a finance suite. Each one is designed to be used in the
                  thirty seconds between customers.
                </p>
              </div>
            </Reveal>

            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((f, i) => (
                <Reveal key={f.title} delay={i * 60}>
                  <article className="group h-full rounded-3xl border border-line bg-surface p-6 transition-all duration-300 hover:-translate-y-1 hover:border-emerald/35 hover:shadow-depth">
                    <span className="flex size-11 items-center justify-center rounded-2xl bg-emerald-wash text-emerald-ink transition-colors group-hover:bg-emerald group-hover:text-on-emerald">
                      <f.Icon className="size-5" aria-hidden />
                    </span>
                    <h3 className="mt-4 text-lg font-bold">{f.title}</h3>
                    <p className="mt-2 text-slate">{f.body}</p>
                  </article>
                </Reveal>
              ))}
            </div>

            <Reveal delay={100} className="mt-4">
              <div className="grid items-stretch gap-4 overflow-hidden rounded-3xl border border-line bg-surface lg:grid-cols-[1.15fr_1fr]">
                <div className="flex flex-col justify-center p-6 md:p-8">
                  <p className="eyebrow">
                    <span aria-hidden className="h-px w-6 bg-emerald" /> The screen you&apos;ll open most
                  </p>
                  <h3 className="mt-3 text-2xl font-extrabold md:text-3xl">
                    One dashboard, four questions answered
                  </h3>
                  <ul className="mt-4 space-y-2.5 text-ink-soft">
                    {[
                      "How much came in today?",
                      "How much went out?",
                      "Who still owes me?",
                      "Is the business improving, flat, or slipping?",
                    ].map((q) => (
                      <li key={q} className="flex gap-2.5">
                        <ChevronRight className="mt-0.5 size-4 shrink-0 text-emerald" aria-hidden />
                        {q}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-5 text-sm text-slate">
                    Every figure comes from records you entered. Nothing is estimated, and nothing is
                    sold or shared.
                  </p>
                </div>
                <div className="bg-sunken/60 p-5 md:p-7">
                  <SampleDashboard />
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ---------- How it works ---------- */}
        <section
          id="how-it-works"
          aria-labelledby="how"
          className="scroll-mt-24 border-y border-line bg-sunken/70"
        >
          <div className="mx-auto w-full max-w-6xl px-5 py-16 md:px-8 md:py-24">
            <Reveal>
              <p className="eyebrow">
                <span aria-hidden className="h-px w-6 bg-emerald" /> How it works
              </p>
              <h2 id="how" className="mt-3 max-w-2xl text-3xl font-extrabold leading-tight md:text-[2.6rem]">
                Up and running before the next customer walks in
              </h2>
            </Reveal>

            <ol className="mt-10 grid gap-4 md:grid-cols-3">
              {STEPS.map((s, i) => (
                <Reveal key={s.n} delay={i * 90}>
                  <li className="relative h-full rounded-3xl border border-line bg-surface p-6 md:p-7">
                    <span className="figure text-4xl font-extrabold text-emerald/35">{s.n}</span>
                    <h3 className="mt-3 text-xl font-bold">{s.title}</h3>
                    <p className="mt-2 text-slate">{s.body}</p>
                    {i < STEPS.length - 1 && (
                      <span
                        aria-hidden
                        className="step-line absolute -right-2 top-1/2 hidden h-px w-4 md:block"
                      />
                    )}
                  </li>
                </Reveal>
              ))}
            </ol>

            <Reveal delay={120}>
              <p className="mt-6 text-sm text-slate">
                SettleNG runs in the browser on any phone. No app to install, no bank details to hand
                over.
              </p>
            </Reveal>
          </div>
        </section>

        {/* ---------- Who it's for ---------- */}
        <section id="who-it-is-for" aria-labelledby="who" className="scroll-mt-24">
          <div className="mx-auto w-full max-w-6xl px-5 py-16 md:px-8 md:py-24">
            <Reveal>
              <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="eyebrow">
                    <span aria-hidden className="h-px w-6 bg-emerald" /> Who it&apos;s for
                  </p>
                  <h2 id="who" className="mt-3 max-w-2xl text-3xl font-extrabold leading-tight md:text-[2.6rem]">
                    If you sell, it fits how you already work
                  </h2>
                </div>
                <p className="max-w-sm text-ink-soft">
                  A stall, a shop, a workshop, a phone number customers call. SettleNG keeps the
                  record while you keep trading.
                </p>
              </div>
            </Reveal>

            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              {AUDIENCE.map((a, i) => (
                <Reveal key={a.label} delay={i * 80}>
                  <figure className="group h-full overflow-hidden rounded-3xl border border-line bg-surface">
                    <div className="frame-photo aspect-[4/5] rounded-none shadow-none">
                      <Image
                        src={a.img}
                        alt={a.alt}
                        fill
                        sizes="(max-width: 640px) 92vw, 340px"
                        className="object-cover"
                      />
                    </div>
                    <figcaption className="p-5">
                      <h3 className="text-lg font-bold">{a.label}</h3>
                      <p className="mt-1 text-sm text-slate">{a.body}</p>
                    </figcaption>
                  </figure>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ---------- Free, always ---------- */}
        <section aria-labelledby="free" className="border-y border-line bg-gold-wash/60">
          <div className="mx-auto grid w-full max-w-6xl items-center gap-8 px-5 py-14 md:grid-cols-[1.1fr_1fr] md:px-8 md:py-20">
            <Reveal>
              <p className="eyebrow text-gold">The zero-cost promise</p>
              <h2 id="free" className="mt-3 text-3xl font-extrabold leading-tight md:text-[2.5rem]">
                Keeping track of your money should not be another expense.
              </h2>
              <p className="mt-4 max-w-xl text-lg text-ink-soft">
                Every core part of SettleNG is free: recording sales and expenses, customer debts,
                invoices, reports and matching. No trial, no paywall, no card details, no adverts
                inside your records.
              </p>
            </Reveal>
            <Reveal delay={100}>
              <ul className="grid gap-3 sm:grid-cols-2">
                {[
                  "No subscription",
                  "No payment card",
                  "No premium tier",
                  "No ads in your dashboard",
                ].map((t) => (
                  <li
                    key={t}
                    className="flex items-center gap-2.5 rounded-2xl border border-gold/25 bg-surface px-4 py-3 font-semibold"
                  >
                    <Check className="size-4 shrink-0 text-gold" aria-hidden /> {t}
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
        </section>

        {/* ---------- Trust ---------- */}
        <section aria-labelledby="trust">
          <div className="mx-auto w-full max-w-6xl px-5 py-16 md:px-8 md:py-20">
            <Reveal>
              <div className="grid gap-8 rounded-3xl border border-line bg-surface p-6 md:grid-cols-[1fr_1.2fr] md:p-10">
                <div>
                  <p className="eyebrow">
                    <span aria-hidden className="h-px w-6 bg-emerald" /> Your records
                  </p>
                  <h2 id="trust" className="mt-3 text-2xl font-extrabold md:text-3xl">
                    Private by design, plain about what it does
                  </h2>
                  <p className="mt-3 text-ink-soft">
                    SettleNG is a record-keeping tool. It does not connect to your bank, move money,
                    or take a cut of anything.
                  </p>
                </div>
                <ul className="grid gap-4 sm:grid-cols-2">
                  {[
                    {
                      Icon: ShieldCheck,
                      title: "Sign-in you control",
                      body: "Accounts are secured through Supabase authentication, with email and password.",
                    },
                    {
                      Icon: Lock,
                      title: "Only you see your books",
                      body: "Your business records are tied to your account and served over HTTPS.",
                    },
                    {
                      Icon: Wallet,
                      title: "No bank connection",
                      body: "Nothing is linked to your account or BVN. You type what you want recorded.",
                    },
                    {
                      Icon: FileText,
                      title: "Your data, exportable",
                      body: "Reports can be downloaded as CSV so the record stays yours.",
                    },
                  ].map((t) => (
                    <li key={t.title}>
                      <t.Icon className="size-5 text-emerald" aria-hidden />
                      <h3 className="mt-2 font-bold">{t.title}</h3>
                      <p className="mt-1 text-sm text-slate">{t.body}</p>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ---------- Closing CTA ---------- */}
        <section aria-labelledby="cta" className="pb-16 md:pb-24">
          <div className="mx-auto w-full max-w-6xl px-5 md:px-8">
            <Reveal>
              <div className="panel-dark grain relative grid overflow-hidden rounded-[2rem] lg:grid-cols-[1.15fr_0.85fr]">
                <div className="relative p-7 md:p-12">
                  <h2 id="cta" className="max-w-lg text-3xl font-extrabold leading-tight text-white md:text-[2.6rem]">
                    Start with today&apos;s sales.
                  </h2>
                  <p className="mt-4 max-w-md text-lg text-white/75">
                    Sign up free, name your business, and record your first sale in a couple of
                    minutes. No card, no bank details, no commitment.
                  </p>
                  <div className="mt-7 flex flex-wrap gap-3">
                    <Link
                      href="/signup"
                      className={cn(
                        buttonVariants({ size: "lg" }),
                        "bg-white text-panel hover:bg-white/90",
                      )}
                    >
                      Start tracking for free <ArrowRight className="size-5" aria-hidden />
                    </Link>
                    <Link
                      href="/about"
                      className={cn(
                        buttonVariants({ variant: "outline", size: "lg" }),
                        "border-white/25 bg-transparent text-white hover:bg-white/10",
                      )}
                    >
                      Why we built this
                    </Link>
                  </div>
                  <p className="mt-4 text-sm text-white/55">
                    Already have an account?{" "}
                    <Link href="/login" className="font-semibold text-white underline">
                      Log in
                    </Link>
                  </p>
                </div>
                <div className="relative min-h-[16rem] lg:min-h-0">
                  <Image
                    src="/images/craft-tailor.jpg"
                    alt="A tailor in green ankara fabric working at a vintage sewing machine in Lagos"
                    fill
                    sizes="(max-width: 1024px) 100vw, 420px"
                    className="object-cover object-top"
                  />
                  <div
                    aria-hidden
                    className="absolute inset-0 bg-gradient-to-r from-panel via-panel/30 to-transparent lg:from-panel lg:via-panel/10"
                  />
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
