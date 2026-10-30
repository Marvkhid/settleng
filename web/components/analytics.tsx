"use client";
import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import { usePathname } from "next/navigation";

/**
 * Google Analytics 4, and nothing happened unless it is configured: with no
 * NEXT_PUBLIC_GA_ID in the environment the component renders nothing at all, so the site keeps
 * working exactly as before (and its privacy page stays accurate).
 *
 * Privacy controls applied here:
 * - honours the browser's Do Not Track / Global Privacy Control signal;
 * - only ever sends a page path, never form contents, account ids or amounts;
 * - records no advertising identifiers, no user ids and no cross-site signals.
 */
export function Analytics({ measurementId }: { measurementId?: string }) {
  const pathname = usePathname();
  const [allowed, setAllowed] = useState(false);
  const firstRender = useRef(true);

  useEffect(() => {
    if (!measurementId) return;
    const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
    const dnt = nav.doNotTrack === "1" || nav.globalPrivacyControl === true;
    if (dnt) return;
    // Deferred by a tick so the analytics tag is never part of the hydration render.
    const id = window.setTimeout(() => setAllowed(true), 0);
    return () => window.clearTimeout(id);
  }, [measurementId]);

  useEffect(() => {
    if (!allowed || !measurementId) return;
    // The initial page_view comes from gtag('config'); only client-side navigations need this.
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const w = window as unknown as { gtag?: (...args: unknown[]) => void };
    w.gtag?.("event", "page_view", { page_path: pathname });
  }, [pathname, allowed, measurementId]);

  if (!measurementId || !allowed) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
        strategy="afterInteractive"
      />
      <Script id="ga4-init" strategy="afterInteractive">
        {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${measurementId}',{anonymize_ip:true,allow_google_signals:false,allow_ad_personalization_signals:false});`}
      </Script>
    </>
  );
}
