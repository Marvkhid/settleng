import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Toaster } from "sonner";
import "./globals.css";

const display = localFont({ src: "./fonts/Bricolage.woff2", variable: "--font-display", weight: "200 800", display: "swap" });
const body = localFont({ src: "./fonts/Figtree.woff2", variable: "--font-body", weight: "300 900", display: "swap" });

export const metadata: Metadata = {
  title: { default: "SettleNG", template: "%s · SettleNG" },
  description: "Track sales, expenses, customer debts and payments in one simple place. Built for small Nigerian businesses.",
};
export const viewport: Viewport = { themeColor: "#faf8f4" };

// Applies the stored (or system) theme before paint so there is no light/dark flash on load. Kept as
// a raw string and inlined by Next; it mirrors the logic in lib/theme.ts.
const themeScript = `(function(){try{var k="settleng-theme";var s=localStorage.getItem(k);var t=s==="dark"||s==="light"?s:(window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");var r=document.documentElement;r.classList.toggle("dark",t==="dark");r.style.colorScheme=t;}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster position="top-center" richColors closeButton toastOptions={{ className: "font-body" }} />
      </body>
    </html>
  );
}
