import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Bell,
  Check,
  ChevronRight,
  FileText,
  GitCompareArrows,
  HandCoins,
  Home,
  LayoutGrid,
  LineChart,
  Lock,
  Menu,
  PieChart,
  Plus,
  ReceiptText,
  Settings,
  ShieldCheck,
  Smartphone,
  Users,
  Wallet,
} from "lucide-react";
import { Reveal } from "@/components/marketing/reveal";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "How to use SettleNG — a guided tour",
  description:
    "New to SettleNG? Learn what it is, what each screen does, and how to record sales, track debts, send reminders and read your reports — step by step.",
  alternates: { canonical: "/guide" },
};

const WHAT_IT_IS = [
  {
    Icon: Wallet,
    title: "A record book, not a bank",
    body: "SettleNG keeps the record of what you sold, what you spent and who still owes you. It never connects to your bank, moves money, or takes a cut.",
  },
  {
    Icon: Users,
    title: "Built for how traders work",
    body: "Thirty seconds between customers is all it takes: tap, type an amount, done. Everything is designed for a phone held in one hand.",
  },
  {
    Icon: Lock,
    title: "Private to your workspace",
    body: "Your records belong to your workspace. Only people you invite can see them, and switching workspaces never mixes two sets of books.",
  },
];

const FEATURES = [
  { Icon: Wallet, title: "Sales", body: "Cash, transfer, POS or credit — recorded the moment it happens." },
  { Icon: ReceiptText, title: "Expenses", body: "Stock, transport, rent and wages, with categories you can read later." },
  { Icon: Users, title: "Customers", body: "One list of everyone who owes you, with how long it has been outstanding." },
  { Icon: FileText, title: "Invoices", body: "Itemised invoices, part payments applied oldest-first, and a clear balance." },
  { Icon: HandCoins, title: "Debts", body: "Money owed to you or by you, with payments, evidence and a payment link." },
  { Icon: Bell, title: "Reminders", body: "Automatic emails to you when a debt is still unpaid — never to the debtor." },
  { Icon: LineChart, title: "Reports", body: "Revenue, expenses and profit over 7 days to a year, plus CSV exports." },
  { Icon: PieChart, title: "Analytics", body: "Cash flow, spending by category, debt ageing and your biggest debtors." },
  { Icon: GitCompareArrows, title: "Match records", body: "Import a bank statement and link each payment to the right invoice." },
];

const START_STEPS = [
  {
    n: "01",
    title: "Create your free account",
    body: "Tap “Start tracking free”, enter your name, business name and a password. No card, no bank details. If your email needs confirming, we tell you plainly instead of pretending you are signed in.",
    img: "/images/craft-tailor.jpg",
    alt: "A tailor working at a sewing machine in Lagos",
    href: "/signup",
    link: "Create an account",
  },
  {
    n: "02",
    title: "Land on your dashboard",
    body: "Home answers four questions: what came in today, what went out, who still owes you, and whether the month is improving. Every figure comes from records you entered — nothing is estimated.",
    img: "/images/feature-reports.jpg",
    alt: "A business owner reviewing performance figures",
  },
  {
    n: "03",
    title: "Record your first sale",
    body: "Tap the green + button (phone) or “Record a sale” (desktop). Choose how the money came in. If it was on credit, SettleNG opens an invoice so the balance is tracked from the start.",
    img: "/images/feature-sales.jpg",
    alt: "Recording a sale on a phone",
  },
  {
    n: "04",
    title: "Write down what you spent",
    body: "Same + button, “Record an expense”. Pick a category — stock, transport, rent, wages. This is the half most people skip, and it is the half that tells you whether you actually made a profit.",
    img: "/images/feature-expenses.jpg",
    alt: "Recording an expense",
  },
  {
    n: "05",
    title: "Track who owes you",
    body: "Open Debts (or Customers) to see every balance. Record part payments as they come in; the outstanding amount updates immediately. When a debt reaches zero it closes itself.",
    img: "/images/feature-debts.jpg",
    alt: "A list of customers who owe money",
  },
];

const TOUR = [
  {
    Icon: Home,
    label: "Home",
    where: "Bottom bar, left",
    body: "Today's takings, money in and out, who owes you, and the latest records.",
  },
  {
    Icon: Wallet,
    label: "Sales & Expenses",
    where: "More menu (phone) · sidebar (desktop)",
    body: "Every record, searchable and filterable by date, category and payment method.",
  },
  {
    Icon: Users,
    label: "Customers",
    where: "Bottom bar (phone) · sidebar (desktop)",
    body: "Each customer's total owing, their invoices, and a one-tap “they paid me”.",
  },
  {
    Icon: FileText,
    label: "Invoices",
    where: "Bottom bar (phone) · sidebar (desktop)",
    body: "Draft, issue, record payments, void — with the balance always recalculated.",
  },
  {
    Icon: HandCoins,
    label: "Debts",
    where: "More menu · sidebar",
    body: "Money owed to you and by you, with repayments, documents and payment links.",
  },
  {
    Icon: Bell,
    label: "Reminders",
    where: "More menu · sidebar",
    body: "Turn on automatic emails per debt, choose times, pause, and read the delivery history.",
  },
  {
    Icon: LineChart,
    label: "Reports",
    where: "More menu · sidebar",
    body: "Pick a period, see revenue, expenses and profit, and download a CSV.",
  },
  {
    Icon: PieChart,
    label: "Analytics",
    where: "More menu · sidebar",
    body: "Spending by category, cash-flow trend, ageing debts and your top debtors.",
  },
  {
    Icon: GitCompareArrows,
    label: "Match records",
    where: "More menu · sidebar",
    body: "Upload a statement, review the rows, and link each one to an invoice or mark it ignored.",
  },
  {
    Icon: ShieldCheck,
    label: "Team",
    where: "More menu · sidebar",
    body: "Invite a manager or staff member to the workspace and set what they can do.",
  },
  {
    Icon: Settings,
    label: "Settings",
    where: "More menu · sidebar",
    body: "Business name, appearance, your account, and the way out if you ever want to leave.",
  },
];

const WORKFLOWS = [
  {
    title: "A customer takes goods on credit",
    steps: [
      "Tap + and record the sale, choosing “Credit”.",
      "SettleNG opens an invoice with the balance owed.",
      "The customer appears under Customers with the amount outstanding.",
    ],
  },
  {
    title: "You want to stop chasing manually",
    steps: [
      "Open the debt and turn on Smart email reminders.",
      "Pick one, two or three times a day, or your own times, in your timezone.",
      "SettleNG emails you — never the debtor — and logs exactly what the provider answered.",
    ],
  },
  {
    title: "The customer pays part of it",
    steps: [
      "Open the debt and tap “Record payment”.",
      "Enter the amount; the balance drops and the history keeps the record.",
      "When the balance reaches zero the debt closes and its reminders stop.",
    ],
  },
  {
    title: "End of the month",
    steps: [
      "Open Reports and choose the period.",
      "Read revenue, expenses and net profit, then export a CSV if you need it.",
      "Check Analytics for what you spent the most on and who owes you most.",
    ],
  },
];

export default function GuidePage() {
  return (
    <>
      <SiteHeader />

      <main id="main" className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden border-b border-line">
          <div
            aria-hidden
            className="pointer-events-none absolute -left-32 top-[-8rem] size-[26rem] rounded-full bg-emerald/10 blur-3xl"
          />
          <div className="relative mx-auto grid w-full max-w-6xl items-center gap-10 px-5 py-12 md:px-8 md:py-20 lg:grid-cols-[1.05fr_0.95fr]">
            <div>
              <Reveal>
                <p className="inline-flex items-center gap-2 rounded-full border border-emerald/25 bg-emerald-wash px-3.5 py-1.5 text-sm font-semibold text-emerald-ink">
                  <span aria-hidden className="size-2 rounded-full bg-emerald" /> A guided tour
                </p>
              </Reveal>
              <Reveal delay={70}>
                <h1 className="mt-5 text-[clamp(2.2rem,5vw,3.4rem)] font-extrabold leading-[1.05] text-ink">
                  What SettleNG is, and how to move around it
                </h1>
              </Reveal>
              <Reveal delay={120}>
                <p className="mt-5 max-w-xl text-lg text-ink-soft">
                  Five minutes here and you will know every screen. No jargon, no finance degree —
                  just the shortest path from “I sold something” to “I know exactly where I stand”.
                </p>
              </Reveal>
              <Reveal delay={170}>
                <div className="mt-7 flex flex-wrap gap-3">
                  <Link href="/signup" className={cn(buttonVariants({ size: "lg" }), "shadow-glow")}>
                    Start tracking free <ArrowRight className="size-5" aria-hidden />
                  </Link>
                  <Link href="#tour" className={cn(buttonVariants({ variant: "outline", size: "lg" }))}>
                    Jump to the screen tour
                  </Link>
                </div>
              </Reveal>
            </div>
            <Reveal delay={140}>
              <div className="frame-photo grain aspect-[4/3] w-full">
                <Image
                  src="/images/hero-market.jpg"
                  alt="A trader arranging produce at a busy Lagos market"
                  fill
                  priority
                  sizes="(max-width: 1024px) 92vw, 480px"
                  className="object-cover object-[65%_center]"
                />
              </div>
            </Reveal>
          </div>
        </section>

        {/* What it is */}
        <section aria-labelledby="what" className="mx-auto w-full max-w-6xl px-5 py-14 md:px-8 md:py-20">
          <Reveal>
            <p className="eyebrow">
              <span aria-hidden className="h-px w-6 bg-emerald" /> In one paragraph
            </p>
            <h2 id="what" className="mt-3 max-w-3xl text-3xl font-extrabold leading-tight md:text-[2.4rem]">
              SettleNG is the notebook your business deserves.
            </h2>
            <p className="mt-4 max-w-3xl text-lg text-ink-soft">
              You record sales and expenses as they happen. SettleNG turns those records into a
              running balance, a list of who owes you, invoices you can send, and reports that show
              whether the business is growing. It is free, it works in any browser, and it never
              touches your money.
            </p>
          </Reveal>

          <div className="mt-9 grid gap-4 md:grid-cols-3">
            {WHAT_IT_IS.map((item, i) => (
              <Reveal key={item.title} delay={i * 70}>
                <article className="h-full rounded-3xl border border-line bg-surface p-6">
                  <span className="flex size-11 items-center justify-center rounded-2xl bg-emerald-wash text-emerald-ink">
                    <item.Icon className="size-5" aria-hidden />
                  </span>
                  <h3 className="mt-4 text-lg font-bold">{item.title}</h3>
                  <p className="mt-2 text-slate">{item.body}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </section>

        {/* What it does */}
        <section aria-labelledby="does" className="border-y border-line bg-sunken/70">
          <div className="mx-auto w-full max-w-6xl px-5 py-14 md:px-8 md:py-20">
            <Reveal>
              <h2 id="does" className="text-3xl font-extrabold leading-tight md:text-[2.4rem]">
                Nine things it does
              </h2>
              <p className="mt-3 max-w-2xl text-ink-soft">
                Each one is a single screen. You never have to learn the whole app to use one part of it.
              </p>
            </Reveal>
            <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((f, i) => (
                <Reveal key={f.title} delay={i * 40}>
                  <div className="flex h-full items-start gap-3 rounded-2xl border border-line bg-surface p-4">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-emerald-wash text-emerald-ink">
                      <f.Icon className="size-4" aria-hidden />
                    </span>
                    <div>
                      <h3 className="font-bold">{f.title}</h3>
                      <p className="mt-1 text-sm text-slate">{f.body}</p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* Getting started */}
        <section aria-labelledby="start" className="mx-auto w-full max-w-6xl px-5 py-14 md:px-8 md:py-20">
          <Reveal>
            <p className="eyebrow">
              <span aria-hidden className="h-px w-6 bg-emerald" /> Step by step
            </p>
            <h2 id="start" className="mt-3 max-w-2xl text-3xl font-extrabold leading-tight md:text-[2.4rem]">
              Your first day, in five steps
            </h2>
          </Reveal>

          <ol className="mt-9 space-y-6">
            {START_STEPS.map((step, i) => (
              <Reveal key={step.n} delay={i * 60}>
                <li className="grid items-center gap-5 overflow-hidden rounded-3xl border border-line bg-surface md:grid-cols-2">
                  <div className={cn("p-6 md:p-8", i % 2 === 1 && "md:order-2")}>
                    <span className="figure text-3xl font-extrabold text-emerald/35">{step.n}</span>
                    <h3 className="mt-2 text-xl font-bold md:text-2xl">{step.title}</h3>
                    <p className="mt-2 text-ink-soft">{step.body}</p>
                    {step.href && (
                      <Link
                        href={step.href}
                        className="mt-4 inline-flex min-h-11 items-center gap-1.5 font-semibold text-emerald-ink hover:underline"
                      >
                        {step.link} <ArrowRight className="size-4" aria-hidden />
                      </Link>
                    )}
                  </div>
                  <div className={cn("frame-photo aspect-[16/10] rounded-none shadow-none", i % 2 === 1 && "md:order-1")}>
                    <Image
                      src={step.img}
                      alt={step.alt}
                      fill
                      sizes="(max-width: 768px) 92vw, 460px"
                      className="object-cover"
                    />
                  </div>
                </li>
              </Reveal>
            ))}
          </ol>
        </section>

        {/* Tour */}
        <section id="tour" aria-labelledby="tour-heading" className="scroll-mt-24 border-y border-line bg-sunken/70">
          <div className="mx-auto w-full max-w-6xl px-5 py-14 md:px-8 md:py-20">
            <Reveal>
              <h2 id="tour-heading" className="text-3xl font-extrabold leading-tight md:text-[2.4rem]">
                Every screen, and where to find it
              </h2>
              <p className="mt-3 max-w-2xl text-ink-soft">
                On a phone, five items sit at the bottom and everything else is behind <strong>More</strong>.
                On a laptop or tablet, the same list runs down the left side.
              </p>
            </Reveal>

            <div className="mt-8 grid gap-4 lg:grid-cols-[1.1fr_1fr]">
              <Reveal>
                <div className="grid gap-2">
                  {TOUR.map((t) => (
                    <div key={t.label} className="flex items-start gap-3 rounded-2xl border border-line bg-surface p-4">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-emerald-wash text-emerald-ink">
                        <t.Icon className="size-4" aria-hidden />
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-baseline gap-x-2">
                          <h3 className="font-bold">{t.label}</h3>
                          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate">{t.where}</span>
                        </div>
                        <p className="mt-1 text-sm text-slate">{t.body}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Reveal>

              <Reveal delay={80}>
                <div className="sticky top-24 space-y-4">
                  <div className="rounded-3xl border border-line bg-surface p-5">
                    <h3 className="flex items-center gap-2 text-lg font-bold">
                      <Smartphone className="size-5 text-emerald" aria-hidden /> On a phone
                    </h3>
                    <ul className="mt-3 space-y-2.5 text-sm text-ink-soft">
                      <li className="flex gap-2">
                        <Home className="mt-0.5 size-4 shrink-0 text-emerald" aria-hidden />
                        The bottom bar keeps Home, Customers and Invoices one tap away.
                      </li>
                      <li className="flex gap-2">
                        <Plus className="mt-0.5 size-4 shrink-0 text-emerald" aria-hidden />
                        The green + in the middle records a sale, an expense or a payment from anywhere.
                      </li>
                      <li className="flex gap-2">
                        <Menu className="mt-0.5 size-4 shrink-0 text-emerald" aria-hidden />
                        <span>
                          <strong>More</strong> holds Debts, Reminders, Reports, Analytics, Match records,
                          Team, Settings and this guide.
                        </span>
                      </li>
                    </ul>
                  </div>

                  <div className="rounded-3xl border border-line bg-surface p-5">
                    <h3 className="flex items-center gap-2 text-lg font-bold">
                      <LayoutGrid className="size-5 text-emerald" aria-hidden /> On a computer
                    </h3>
                    <p className="mt-2 text-sm text-ink-soft">
                      The sidebar lists every section. The workspace switcher at the top swaps between
                      your personal books and any business you run — each keeps its own records.
                    </p>
                  </div>

                  <div className="rounded-3xl border border-emerald/25 bg-emerald-wash/60 p-5">
                    <h3 className="font-bold text-emerald-ink">One habit that makes it work</h3>
                    <p className="mt-1 text-sm text-ink-soft">
                      Record the sale before the customer leaves the shop. Everything else — balances,
                      reports, reminders — is only as good as that one habit.
                    </p>
                  </div>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* Workflows */}
        <section aria-labelledby="workflows" className="mx-auto w-full max-w-6xl px-5 py-14 md:px-8 md:py-20">
          <Reveal>
            <h2 id="workflows" className="text-3xl font-extrabold leading-tight md:text-[2.4rem]">
              Four things you will do often
            </h2>
          </Reveal>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {WORKFLOWS.map((w, i) => (
              <Reveal key={w.title} delay={i * 60}>
                <article className="h-full rounded-3xl border border-line bg-surface p-6">
                  <h3 className="text-lg font-bold">{w.title}</h3>
                  <ol className="mt-3 space-y-2.5">
                    {w.steps.map((s, idx) => (
                      <li key={s} className="flex gap-2.5 text-sm text-ink-soft">
                        <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-wash text-[11px] font-bold text-emerald-ink">
                          {idx + 1}
                        </span>
                        {s}
                      </li>
                    ))}
                  </ol>
                </article>
              </Reveal>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section aria-labelledby="faq" className="border-t border-line bg-sunken/70">
          <div className="mx-auto w-full max-w-4xl px-5 py-14 md:px-8 md:py-20">
            <Reveal>
              <h2 id="faq" className="text-3xl font-extrabold leading-tight md:text-[2.4rem]">
                Questions people ask first
              </h2>
            </Reveal>
            <div className="mt-7 space-y-3">
              {[
                {
                  q: "Does SettleNG move or hold my money?",
                  a: "No. It is a record-keeping tool. There is no bank connection, no card, and no wallet. Payment links only show the amount and a reference — the money still goes to you directly.",
                },
                {
                  q: "Is it really free?",
                  a: "Yes. Recording, debts, invoices, reminders, reports and matching are all free. There is no subscription, no premium tier and no ads inside your records.",
                },
                {
                  q: "Who can see my records?",
                  a: "Only people in your workspace. Each workspace's data is kept separate on the server, and switching workspaces shows only that workspace's numbers.",
                },
                {
                  q: "Do reminders email my customer?",
                  a: "Never. Reminder emails go to you, the owner, so you remember to follow up. Your customer is not contacted.",
                },
                {
                  q: "Can I use it on my phone without installing anything?",
                  a: "Yes — it runs in the browser. You can also add it to your home screen from your browser menu so it opens like an app.",
                },
              ].map((item) => (
                <details key={item.q} className="group rounded-2xl border border-line bg-surface p-4 open:shadow-sm">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-bold">
                    {item.q}
                    <ChevronRight className="size-4 shrink-0 text-slate transition-transform group-open:rotate-90" aria-hidden />
                  </summary>
                  <p className="mt-2 text-sm text-ink-soft">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="mx-auto w-full max-w-6xl px-5 py-14 md:px-8 md:py-20">
          <div className="ruled grain relative overflow-hidden rounded-[2rem] p-7 md:p-12">
            <h2 className="max-w-lg text-3xl font-extrabold leading-tight text-white md:text-[2.4rem]">
              Ready to try it with today&apos;s sales?
            </h2>
            <p className="mt-3 max-w-md text-lg text-white/70">
              It takes about two minutes to set up, and the first record is the one that matters.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/signup" className={cn(buttonVariants({ size: "lg" }), "bg-white text-panel hover:bg-white/90")}>
                Start tracking free <ArrowRight className="size-5" aria-hidden />
              </Link>
              <Link
                href="/login"
                className={cn(buttonVariants({ variant: "outline", size: "lg" }), "border-white/25 bg-transparent text-white hover:bg-white/10")}
              >
                I already have an account
              </Link>
            </div>
            <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm text-white/60">
              {["No card details", "No bank login", "Free, always"].map((t) => (
                <li key={t} className="inline-flex items-center gap-1.5">
                  <Check className="size-4 text-emerald" aria-hidden /> {t}
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
