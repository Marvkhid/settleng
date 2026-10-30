"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Menu } from "lucide-react";
import { Wordmark } from "@/components/brand/logo";
import { buttonVariants } from "@/components/ui/button";
import { Sheet } from "@/components/ui/dialog";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#features", label: "What it does" },
  { href: "/#who-it-is-for", label: "Who it's for" },
  { href: "/about", label: "About" },
  { href: "/support", label: "Support" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b transition-colors duration-300",
        scrolled
          ? "border-line bg-paper/85 backdrop-blur-xl supports-[backdrop-filter]:bg-paper/70"
          : "border-transparent bg-paper",
      )}
    >
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 py-3 md:px-8">
        <Wordmark />

        <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg px-3 py-2 text-sm font-semibold text-ink-soft transition-colors hover:bg-sunken hover:text-ink"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link
            href="/login"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "hidden sm:inline-flex")}
          >
            Log in
          </Link>
          <Link href="/signup" className={cn(buttonVariants({ size: "sm" }), "hidden sm:inline-flex")}>
            Start tracking free
          </Link>
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            className="flex size-11 items-center justify-center rounded-xl border border-line bg-surface text-ink lg:hidden"
          >
            <Menu className="size-5" aria-hidden />
          </button>
        </div>
      </div>

      <Sheet open={open} onOpenChange={setOpen} title="Menu" description="SettleNG">
        <div className="grid gap-1">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="flex min-h-14 items-center rounded-xl px-3 text-lg font-semibold hover:bg-sunken"
            >
              {item.label}
            </Link>
          ))}
          <div className="mt-3 grid gap-2 border-t border-line pt-3">
            <Link
              href="/login"
              onClick={() => setOpen(false)}
              className={cn(buttonVariants({ variant: "outline" }), "w-full")}
            >
              Log in
            </Link>
            <Link href="/signup" onClick={() => setOpen(false)} className={cn(buttonVariants(), "w-full")}>
              Start tracking free <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
        </div>
      </Sheet>
    </header>
  );
}
