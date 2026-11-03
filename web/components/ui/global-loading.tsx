"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";
import {
  finishNavigation,
  getLoadingSnapshot,
  getServerLoadingSnapshot,
  startNavigation,
  subscribeLoading,
} from "@/lib/loading";

/**
 * A single app-wide overlay: a light paper wash, a gentle 4px backdrop blur (the page stays
 * readable behind it) and a brand spinner. It blocks clicks while it is up and fades both ways.
 * Mounted once in the root layout, so two overlays can never appear at the same time.
 */
export function GlobalLoading() {
  const active = useSyncExternalStore(
    subscribeLoading,
    getLoadingSnapshot,
    getServerLoadingSnapshot,
  );

  return (
    <div
      data-testid="app-loading-overlay"
      role="status"
      aria-live="polite"
      aria-busy={active}
      aria-hidden={!active}
      className={cn(
        "fixed inset-0 z-[100] flex items-center justify-center",
        active ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
      )}
      style={{
        backgroundColor: "color-mix(in srgb, var(--paper) 78%, transparent)",
        backdropFilter: active ? "blur(4px)" : "blur(0px)",
        WebkitBackdropFilter: active ? "blur(4px)" : "blur(0px)",
        transition:
          "opacity 200ms ease-out, backdrop-filter 200ms ease-out, -webkit-backdrop-filter 200ms ease-out",
      }}
    >
      <div className="flex flex-col items-center gap-3">
        <span aria-hidden className="relative flex size-14 items-center justify-center">
          <span className="absolute inset-0 rounded-full border-[3px] border-emerald/20" />
          <span className="absolute inset-0 animate-spin rounded-full border-[3px] border-transparent border-r-emerald border-t-emerald-ink" />
          <span className="size-2 rounded-full bg-gold" />
        </span>
        <span className="text-sm font-semibold text-ink-soft">One moment…</span>
      </div>
      <span className="sr-only">{active ? "Loading, please wait" : ""}</span>
    </div>
  );
}

/**
 * Opens the overlay on a genuine internal navigation and closes it when the destination renders.
 * Same-path clicks (anchors, filters that only change the query string) are ignored so the overlay
 * never flashes for something that is not a page change.
 *
 * Started by a left-click on an internal link, or by `popstate` — back/forward is browser-initiated
 * so there is no click to catch. Ended by the pathname change (which also covers a navigation that
 * lands on a 404 or an error page), with a safety timer in the store as the last resort for a route
 * request that never comes back at all.
 *
 * Note on failed navigations: Next.js keeps its own bound copy of `fetch`, so wrapping
 * `window.fetch` here observes nothing (verified in the browser — zero router calls seen), and a
 * wrapper would be dead code. Ending on the pathname change plus the safety timer is what actually
 * releases the overlay in those cases.
 */
export function NavigationLoadingBridge() {
  const pathname = usePathname();
  const mounted = useRef(false);
  const seenPathname = useRef(pathname);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    finishNavigation();
    seenPathname.current = pathname;
  }, [pathname]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest?.("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;
      const href = anchor.getAttribute("href");
      if (!href || !href.startsWith("/") || href.startsWith("//")) return;
      const url = new URL(href, window.location.href);
      if (url.pathname === window.location.pathname) return;
      if (url.origin !== window.location.origin) return;
      startNavigation();
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  useEffect(() => {
    const onPopState = () => {
      // A hash-only traversal leaves the pathname alone: nothing is loading, so start nothing.
      if (window.location.pathname === seenPathname.current) return;
      startNavigation();
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  return null;
}
