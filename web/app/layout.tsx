import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Toaster } from "sonner";
import "./globals.css";

const display = localFont({ src: "./fonts/Bricolage.woff2", variable: "--font-display", weight: "200 800", display: "swap" });
const body = localFont({ src: "./fonts/Figtree.woff2", variable: "--font-body", weight: "300 900", display: "swap" });

export const metadata: Metadata = {
  title: { default: "SettleNG", template: "%s · SettleNG" },
  description: "Track sales, expenses, customer debts and payments in one simple place. Demo with sample business data.",
};
export const viewport: Viewport = { themeColor: "#faf8f4" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster position="top-center" richColors closeButton toastOptions={{ className: "font-body" }} />
      </body>
    </html>
  );
}
