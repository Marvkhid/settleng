import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Check, LineChart, ReceiptText, Users, Wallet } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { cn } from "@/lib/utils";

const FEATURES = [
  {
    title: "Sales tracking",
    body: "Write down what you sold in a few taps. Cash, transfer, POS or on credit.",
    Icon: Wallet,
    img: { src: "/images/feature-sales.jpg", alt: "A trader showing his sales on his phone to a customer at a fruit stall" },
  },
  {
    title: "Expense tracking",
    body: "Record stock, transport, rent and wages so you can see where money goes.",
    Icon: ReceiptText,
    img: { src: "/images/feature-expenses.jpg", alt: "A carpenter planing timber in his workshop" },
  },
  {
    title: "Customer debts",
    body: "See who owes you, how much, and since when. Mark payments as they come in.",
    Icon: Users,
    img: { src: "/images/feature-debts.jpg", alt: "A fabric seller resting against a stack of folded Ankara cloth in her shop" },
  },
  {
    title: "Simple reporting",
    body: "A plain summary of sales, spending and debts, ready to download.",
    Icon: LineChart,
    img: { src: "/images/feature-reports.jpg", alt: "A farmer smiling at her phone while holding a basket of produce" },
  },
];

const TRADES = [
  { label: "Tailors & designers", img: { src: "/images/trade-tailor.jpg", alt: "A tailor sewing a garment at her machine" } },
  { label: "Food & produce sellers", img: { src: "/images/trade-food.jpg", alt: "A food seller at her stall of packaged snacks" } },
];

const STEPS = [
  { n: "1", t: "Sign up", d: "Create your account and name your business. It takes under a minute." },
  { n: "2", t: "Record as you go", d: "Log sales and expenses from your phone the moment they happen." },
  { n: "3", t: "Know where you stand", d: "Open the dashboard to see today's money and who still owes you." },
];

const TRUST = ["No bank connection needed", "Works on any phone", "Your data stays yours", "Built for Nigerian businesses"];

function DashboardPreview() {
  const activity = [
    { label: "Sold goods", sub: "Today", amt: "+₦5,000", inc: true },
    { label: "Bought stock", sub: "Today", amt: "-₦8,000", inc: false },
    { label: "Customer payment", sub: "Yesterday", amt: "+₦10,000", inc: true },
  ];
  return (
    <figure className="perspective w-full max-w-md" aria-label="Preview of the SettleNG dashboard">
      <div className="tilt shadow-depth overflow-hidden rounded-3xl bg-panel text-white">
        <div className="ruled px-6 pb-5 pt-6">
          <p className="text-base font-semibold text-white/80">Sales today</p>
          <p className="figure mt-1 text-6xl font-extrabold leading-none">₦48,500</p>
          <div className="mt-4 flex items-center gap-2">
            <span className="relative flex size-2.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald" style={{ animation: "pulse-ring 1.8s ease-out infinite" }} />
              <span className="relative inline-flex size-2.5 rounded-full bg-emerald" />
            </span>
            <span className="text-sm text-white/70">Live preview</span>
          </div>
        </div>
        <div className="grid grid-cols-3 divide-x divide-white/15 border-t border-white/15 bg-black/20 text-sm">
          {[["Spent", "₦12,000"], ["Money in", "₦41,500"], ["Money out", "₦12,000"]].map(([k, v]) => (
            <div key={k} className="px-4 py-3">
              <p className="text-white/70">{k}</p>
              <p className="figure text-lg font-bold">{v}</p>
            </div>
          ))}
        </div>
        <ul className="divide-y divide-white/10 bg-black/20 px-4">
          {activity.map((a) => (
            <li key={a.label} className="flex items-center gap-3 py-3">
              <span aria-hidden className={cn("flex size-9 items-center justify-center rounded-full text-lg", a.inc ? "bg-emerald/20 text-emerald" : "bg-white/10 text-white/70")}>
                {a.inc ? "↓" : "↑"}
              </span>
              <span className="flex-1">
                <span className="block font-semibold">{a.label}</span>
                <span className="block text-sm text-white/60">{a.sub}</span>
              </span>
              <span className={cn("figure font-bold", a.inc ? "text-emerald" : "text-white")}>{a.amt}</span>
            </li>
          ))}
        </ul>
      </div>
      <figcaption className="mt-3 text-sm text-slate">Your dashboard, updated as you record.</figcaption>
    </figure>
  );
}

export default function Landing() {
  return (
    <>
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-4 md:px-8">
        <span className="font-display text-2xl font-extrabold tracking-tight">
          Settle<span className="text-emerald">NG</span>
        </span>
        <nav aria-label="Account" className="flex items-center gap-2">
          <ThemeToggle />
          <Link href="/login" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>Log in</Link>
          <Link href="/signup" className={cn(buttonVariants({ size: "sm" }))}>Get started</Link>
        </nav>
      </header>

      <main id="main" className="flex-1">
        {/* Hero */}
        <section className="hero-grid relative mx-auto grid w-full max-w-6xl items-center gap-10 px-5 pb-16 pt-8 md:grid-cols-[1.05fr_1fr] md:gap-14 md:px-8 md:pb-24 md:pt-14">
          <div>
            <p className="reveal reveal-1 inline-flex items-center gap-2 rounded-full border border-emerald/30 bg-emerald-wash px-3 py-1 text-sm font-semibold text-emerald-ink">
              <Check className="size-4" aria-hidden /> Made for the shop, the stall and the salon
            </p>
            <h1 className="reveal reveal-2 mt-4 text-[clamp(2.6rem,7vw,4.75rem)] font-extrabold leading-[1.02]">
              Know where your business <span className="gradient-text">money</span> is going.
            </h1>
            <p className="reveal reveal-3 mt-5 max-w-xl text-xl text-ink-soft">
              Track sales, expenses, customer debts and payments in one simple place — built for small Nigerian businesses.
            </p>
            <div className="reveal reveal-4 mt-8 flex flex-wrap items-center gap-4">
              <Link href="/signup" className={cn(buttonVariants({ size: "lg" }), "shadow-glow")}>
                Get started free <ArrowRight className="size-5" aria-hidden />
              </Link>
              <Link href="/login" className={cn(buttonVariants({ variant: "outline", size: "lg" }))}>
                Log in
              </Link>
            </div>
            <ul className="reveal reveal-5 mt-8 flex flex-wrap gap-x-6 gap-y-2">
              {TRUST.map((t) => (
                <li key={t} className="flex items-center gap-2 text-sm text-slate">
                  <Check className="size-4 text-emerald" aria-hidden /> {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="reveal reveal-3 flex md:justify-end">
            <DashboardPreview />
          </div>
        </section>

        {/* Illustration band: what SettleNG is about, at a glance */}
        <section aria-labelledby="glance" className="border-y border-line bg-sunken/60">
          <div className="mx-auto w-full max-w-6xl px-5 py-14 md:px-8">
            <h2 id="glance" className="max-w-2xl text-3xl font-extrabold md:text-4xl">
              Everything a busy shop needs. Nothing an accountant would.
            </h2>
            <p className="mt-3 max-w-2xl text-lg text-slate">
              SettleNG turns the notebook by your till into something that adds itself up.
            </p>
            <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {FEATURES.map((f) => (
                <article key={f.title} className="tilt group overflow-hidden rounded-3xl border border-line bg-surface shadow-depth">
                  <div className="relative aspect-4/3 overflow-hidden">
                    <Image
                      src={f.img.src}
                      alt={f.img.alt}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  </div>
                  <div className="p-5">
                    <div className="flex items-center gap-2">
                      <span className="flex size-9 items-center justify-center rounded-xl bg-emerald-wash text-emerald-ink">
                        <f.Icon className="size-5" aria-hidden />
                      </span>
                      <h3 className="text-lg font-bold">{f.title}</h3>
                    </div>
                    <p className="mt-2 text-slate">{f.body}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section aria-labelledby="how" className="mx-auto w-full max-w-6xl px-5 py-16 md:px-8">
          <h2 id="how" className="max-w-2xl text-3xl font-extrabold md:text-4xl">Up and running in three steps</h2>
          <ol className="mt-10 grid gap-6 md:grid-cols-3">
            {STEPS.map((s) => (
              <li key={s.n} className="relative rounded-3xl border border-line bg-surface p-6">
                <span className="figure flex size-12 items-center justify-center rounded-2xl bg-panel text-2xl font-extrabold text-white">{s.n}</span>
                <h3 className="mt-4 text-xl font-bold">{s.t}</h3>
                <p className="mt-2 text-slate">{s.d}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Who it's for */}
        <section aria-labelledby="trades" className="border-y border-line bg-sunken/60">
          <div className="mx-auto w-full max-w-6xl px-5 py-14 md:px-8">
            <h2 id="trades" className="max-w-2xl text-3xl font-extrabold md:text-4xl">
              Made for every kind of business
            </h2>
            <p className="mt-3 max-w-2xl text-lg text-slate">
              Tailors, carpenters, food sellers, farmers, salon owners — if you sell, SettleNG fits how you work.
            </p>
            <div className="mt-10 grid max-w-3xl gap-5 sm:grid-cols-2">
              {TRADES.map((t) => (
                <figure key={t.label} className="tilt group overflow-hidden rounded-3xl border border-line bg-surface shadow-depth">
                  <div className="relative aspect-4/5 overflow-hidden">
                    <Image
                      src={t.img.src}
                      alt={t.img.alt}
                      fill
                      sizes="(max-width: 640px) 100vw, 370px"
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  </div>
                  <figcaption className="px-5 py-4 text-lg font-bold">{t.label}</figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>

        {/* Closing CTA */}
        <section className="mx-auto w-full max-w-6xl px-5 pb-20 md:px-8">
          <div className="grid items-center gap-8 overflow-hidden rounded-3xl bg-panel p-8 text-white md:grid-cols-[1.2fr_1fr] md:p-12">
            <div>
              <h2 className="text-3xl font-extrabold md:text-4xl">Start knowing your numbers today</h2>
              <p className="mt-3 max-w-lg text-lg text-white/80">
                Join the small businesses who ditched the paper notebook. Sign up free and record your first sale in minutes.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link href="/signup" className={cn(buttonVariants({ size: "lg" }), "bg-emerald text-white hover:bg-emerald-deep")}>
                  Get started free <ArrowRight className="size-5" aria-hidden />
                </Link>
                <Link href="/login" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "border-white/30 bg-transparent text-white hover:bg-white/10")}>
                  Log in
                </Link>
              </div>
            </div>
            <div className="float relative aspect-4/5 overflow-hidden rounded-3xl ring-1 ring-white/15">
              <Image
                src="/images/cta-trader.jpg"
                alt="A market trader smiling and giving two thumbs up"
                fill
                sizes="(max-width: 768px) 100vw, 33vw"
                className="object-cover"
              />
            </div>
          </div>
        </section>

        <footer className="border-t border-line bg-sunken/60">
          <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-3 px-5 py-8 text-center sm:flex-row sm:text-left md:px-8">
            <p className="font-display text-xl font-extrabold tracking-tight">
              Settle<span className="text-emerald">NG</span>
            </p>
            <p className="max-w-md text-sm text-slate">
              A simple finance tracker for small Nigerian businesses. SettleNG records what you enter — it does not connect to banks, hold money or process payments.
            </p>
          </div>
        </footer>
      </main>
    </>
  );
}
