import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const FEATURES = [
  ["Sales tracking", "Write down what you sold in a few taps. Cash, transfer, POS or on credit."],
  ["Expense tracking", "Record stock, transport, rent and wages so you can see where money goes."],
  ["Customer debts", "See who owes you, how much, and since when. Mark payments as they come in."],
  ["Invoicing", "Send a proper invoice when a customer needs one. Partial payments are fine."],
  ["Transaction records", "Every naira in and out in one list you can search by date or category."],
  ["Simple reporting", "A plain summary of sales, spending and debts, ready to download."],
];

function Preview() {
  return (
    <figure className="w-full max-w-md" aria-label="Preview of the demo dashboard">
      <div className="ruled overflow-hidden rounded-3xl text-white shadow-xl">
        <div className="px-6 pb-5 pt-6">
          <p className="text-base font-semibold text-white/80">Sales today</p>
          <p className="figure mt-1 text-6xl font-extrabold leading-none">₦48,500</p>
        </div>
        <div className="grid grid-cols-3 divide-x divide-white/15 border-t border-white/15 bg-ink/60 text-sm">
          {[["Spent", "₦12,000"], ["Money in", "₦41,500"], ["Money out", "₦12,000"]].map(([k, v]) => (
            <div key={k} className="px-4 py-3"><p className="text-white/70">{k}</p><p className="figure text-lg font-bold">{v}</p></div>
          ))}
        </div>
      </div>
      <ul className="mt-3 divide-y divide-line rounded-2xl border border-line bg-surface px-4">
        {[["Sold goods", "Today", "+₦5,000", true], ["Bought stock", "Today", "-₦8,000", false], ["Customer payment", "Yesterday", "+₦10,000", true]].map(([l, d, a, inc]) => (
          <li key={l as string} className="flex items-center gap-3 py-3">
            <span aria-hidden className={cn("flex size-9 items-center justify-center rounded-full", inc ? "bg-emerald-wash text-emerald-ink" : "bg-sunken text-ink-soft")}>
              {inc ? <ArrowDownLeft className="size-4" /> : <ArrowUpRight className="size-4" />}
            </span>
            <span className="flex-1"><span className="block font-semibold">{l}</span><span className="block text-sm text-slate">{d}</span></span>
            <span className={cn("figure font-bold", inc ? "text-emerald-ink" : "")}>{a}</span>
          </li>
        ))}
      </ul>
      <figcaption className="mt-2 text-sm text-slate">The demo dashboard, filled with sample business data.</figcaption>
    </figure>
  );
}

export default function Landing() {
  return (
    <>
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-4 md:px-8">
        <span className="font-display text-2xl font-extrabold tracking-tight">Settle<span className="text-emerald">NG</span></span>
        <Link href="/dashboard" className={cn(buttonVariants({ size: "sm" }))}>Explore Demo</Link>
      </header>
      <main id="main" className="flex-1">
        <section className="mx-auto grid w-full max-w-6xl items-center gap-10 px-5 pb-14 pt-8 md:grid-cols-[1.1fr_1fr] md:gap-14 md:px-8 md:pb-24 md:pt-16">
          <div>
            <h1 className="text-[clamp(2.5rem,7vw,4.5rem)] font-extrabold leading-[1.02]">Know where your business money is going.</h1>
            <p className="mt-5 max-w-xl text-xl text-ink-soft">Track sales, expenses, customer debts and payments in one simple place.</p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link href="/dashboard" className={cn(buttonVariants({ size: "lg" }))}>Explore Demo</Link>
              <p className="text-slate">No sign-up. You&apos;ll see a sample shop.</p>
            </div>
          </div>
          <div className="flex md:justify-end"><Preview /></div>
        </section>

        <section aria-labelledby="what" className="border-y border-line bg-sunken">
          <div className="mx-auto w-full max-w-6xl px-5 py-14 md:px-8">
            <h2 id="what" className="max-w-2xl text-3xl font-extrabold md:text-4xl">Made for the shop, the stall and the salon, not for accountants.</h2>
            <dl className="mt-10 grid gap-x-12 gap-y-0 md:grid-cols-2">
              {FEATURES.map(([t, d]) => (
                <div key={t} className="border-t border-ink/15 py-5">
                  <dt className="text-xl font-bold">{t}</dt>
                  <dd className="mt-1 max-w-md text-slate">{d}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-5 py-12 md:px-8">
          <p className="max-w-2xl text-slate">
            SettleNG is a portfolio demonstration. It doesn&apos;t connect to banks, hold money or process payments, and all the business data you see is made up.
          </p>
        </section>
      </main>
    </>
  );
}
