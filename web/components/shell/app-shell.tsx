"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import {
  ArrowDownLeft, ArrowUpRight, FileText, GitCompareArrows, Home, LineChart, Menu, Plus, Settings, Users,
} from "lucide-react";
import { ActionsProvider, useActions } from "@/components/forms/actions";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface Item { href: string; label: string; Icon: typeof Home; match: (p: string, type: string | null) => boolean }
const PRIMARY: Item[] = [
  { href: "/dashboard", label: "Home", Icon: Home, match: (p) => p === "/dashboard" },
  { href: "/transactions?type=INCOME", label: "Sales", Icon: ArrowDownLeft, match: (p, t) => p.startsWith("/transactions") && t === "INCOME" },
  { href: "/transactions?type=EXPENSE", label: "Expenses", Icon: ArrowUpRight, match: (p, t) => p.startsWith("/transactions") && t === "EXPENSE" },
  { href: "/customers", label: "Customers", Icon: Users, match: (p) => p.startsWith("/customers") },
  { href: "/invoices", label: "Invoices", Icon: FileText, match: (p) => p.startsWith("/invoices") },
  { href: "/reports", label: "Reports", Icon: LineChart, match: (p) => p.startsWith("/reports") },
];
const SECONDARY: Item[] = [
  { href: "/reconciliation", label: "Match records", Icon: GitCompareArrows, match: (p) => p.startsWith("/reconciliation") },
  { href: "/settings", label: "Settings", Icon: Settings, match: (p) => p.startsWith("/settings") },
];

export function DemoBadge({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 rounded-full bg-amber-wash px-3 py-1 text-sm font-semibold text-amber", className)}>
      <span aria-hidden className="size-2 rounded-full bg-amber" /> Demo mode · Sample business
    </span>
  );
}

function Wordmark() {
  return (
    <Link href="/dashboard" className="font-display text-2xl font-extrabold tracking-tight text-ink">
      Settle<span className="text-emerald">NG</span>
    </Link>
  );
}

function SideLink({ item, active }: { item: Item; active: boolean }) {
  return (
    <Link href={item.href} aria-current={active ? "page" : undefined}
      className={cn("flex items-center gap-3 rounded-xl px-3 py-2.5 text-base font-semibold transition-colors", active ? "bg-ink text-white" : "text-ink-soft hover:bg-sunken")}>
      <item.Icon className="size-5" aria-hidden /> {item.label}
    </Link>
  );
}

function Sidebar() {
  const path = usePathname();
  const type = useSearchParams().get("type");
  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-6 border-r border-line bg-paper p-5 md:flex">
      <Wordmark />
      <nav aria-label="Main" className="flex flex-col gap-1">{PRIMARY.map((i) => <SideLink key={i.href} item={i} active={i.match(path, type)} />)}</nav>
      <nav aria-label="More" className="mt-auto flex flex-col gap-1 border-t border-line pt-4">{SECONDARY.map((i) => <SideLink key={i.href} item={i} active={i.match(path, type)} />)}</nav>
    </aside>
  );
}

function TopBar() {
  const { openSale, openExpense } = useActions();
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-line bg-paper/95 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur md:px-8">
      <div className="md:hidden"><Wordmark /></div>
      <DemoBadge className="hidden sm:inline-flex" />
      <div className="hidden items-center gap-2 md:flex">
        <Button variant="outline" size="sm" onClick={openExpense}>Record an expense</Button>
        <Button size="sm" onClick={openSale}>Record a sale</Button>
      </div>
    </header>
  );
}

function BottomBar() {
  const path = usePathname();
  const type = useSearchParams().get("type");
  const { openMenu } = useActions();
  const [more, setMore] = useState(false);
  const tab = (item: Item, label = item.label) => {
    const active = item.match(path, type);
    return (
      <Link href={item.href} aria-current={active ? "page" : undefined}
        className={cn("flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-xs font-semibold", active ? "text-emerald-ink" : "text-slate")}>
        <item.Icon className="size-6" aria-hidden /> {label}
      </Link>
    );
  };
  return (
    <>
      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 flex items-end border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden">
        {tab(PRIMARY[0])}
        {tab(PRIMARY[3])}
        <div className="flex flex-1 justify-center">
          <button type="button" onClick={openMenu} aria-label="Record a sale, expense or payment"
            className="-mt-5 flex size-16 items-center justify-center rounded-full bg-emerald text-white shadow-lg ring-4 ring-paper active:bg-emerald-ink">
            <Plus className="size-8" aria-hidden />
          </button>
        </div>
        {tab(PRIMARY[4])}
        <button type="button" onClick={() => setMore(true)} className="flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-xs font-semibold text-slate">
          <Menu className="size-6" aria-hidden /> More
        </button>
      </nav>
      <Sheet open={more} onOpenChange={setMore} title="More">
        <div className="grid gap-1">
          {[PRIMARY[1], PRIMARY[2], PRIMARY[5], ...SECONDARY].map((i) => (
            <Link key={i.href} href={i.href} onClick={() => setMore(false)} className="flex min-h-14 items-center gap-3 rounded-xl px-3 text-lg font-semibold hover:bg-sunken">
              <i.Icon className="size-6 text-slate" aria-hidden /> {i.label}
            </Link>
          ))}
        </div>
        <DemoBadge className="mt-4" />
      </Sheet>
    </>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <ActionsProvider>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:rounded-lg focus:bg-ink focus:px-4 focus:py-2 focus:text-white">Skip to content</a>
      <div className="flex min-h-dvh">
        <Suspense fallback={<div className="hidden w-64 shrink-0 md:block" />}><Sidebar /></Suspense>
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar />
          <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 pb-32 pt-6 md:px-8 md:pb-16 md:pt-8">{children}</main>
        </div>
      </div>
      <Suspense fallback={null}><BottomBar /></Suspense>
    </ActionsProvider>
  );
}
