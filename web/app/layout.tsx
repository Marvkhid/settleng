import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Toaster } from "sonner";
import { Analytics } from "@/components/analytics";
import {
  SITE_DESCRIPTION,
  SITE_KEYWORDS,
  SITE_NAME,
  SITE_TITLE,
  SITE_URL,
} from "@/lib/site";
import "./globals.css";

const display = localFont({ src: "./fonts/Bricolage.woff2", variable: "--font-display", weight: "200 800", display: "swap" });
const body = localFont({ src: "./fonts/Figtree.woff2", variable: "--font-body", weight: "300 900", display: "swap" });

/**
 * Site-wide metadata. Page-level titles use the template, so each page only supplies its own title
 * and description. Canonical URLs are set per page (never here — a shared canonical would make every
 * page claim to be the homepage).
 *
 * Google Search Console: add the verification token as NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION in
 * Vercel, then redeploy; the meta tag is emitted automatically. No token, no tag.
 */
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: SITE_TITLE, template: "%s · SettleNG" },
  description: SITE_DESCRIPTION,
  keywords: SITE_KEYWORDS,
  applicationName: SITE_NAME,
  authors: [{ name: "Marvel Adeniyi", url: `${SITE_URL}/about` }],
  creator: "Marvel Adeniyi",
  publisher: SITE_NAME,
  category: "finance",
  referrer: "origin-when-cross-origin",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: "en_NG",
    url: SITE_URL,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  verification: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
    ? { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION }
    : undefined,
  // icons are generated from app/icon.svg and app/apple-icon.tsx — Next emits the <link> tags.
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: SITE_NAME, statusBarStyle: "default" },
  formatDetection: { telephone: false, email: false, address: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf8f4" },
    { media: "(prefers-color-scheme: dark)", color: "#0a1020" },
  ],
};

// Applies the stored (or system) theme before paint so there is no light/dark flash on load. Kept as
// a raw string and inlined by Next; it mirrors the logic in lib/theme.ts.
const themeScript = `(function(){try{var k="settleng-theme";var s=localStorage.getItem(k);var t=s==="dark"||s==="light"?s:(window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");var r=document.documentElement;r.classList.toggle("dark",t==="dark");r.style.colorScheme=t;}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-NG" className={`${display.variable} ${body.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full flex flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:rounded-lg focus:bg-panel focus:px-4 focus:py-2 focus:text-white"
        >
          Skip to content
        </a>
        {children}
        <Toaster position="top-center" richColors closeButton toastOptions={{ className: "font-body" }} />
        <Analytics measurementId={process.env.NEXT_PUBLIC_GA_ID} />
      </body>
    </html>
  );
}
