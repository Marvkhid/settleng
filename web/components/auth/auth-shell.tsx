import Link from "next/link";
import { ThemeToggle } from "@/components/ui/theme-toggle";

/**
 * Centred card layout for the sign-in / sign-up / password pages, with the wordmark and a link
 * back to the landing page. Kept as a server component so the auth pages stay client-light.
 */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <main id="main" className="relative flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      {/* Soft emerald glow behind the card for a premium feel. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="auth-glow" />
      </div>

      <div className="mb-6 flex w-full max-w-md items-center justify-between">
        <Link href="/" className="font-display text-3xl font-extrabold tracking-tight">
          Settle<span className="text-emerald">NG</span>
        </Link>
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md rounded-3xl border border-line bg-surface/90 p-6 shadow-xl backdrop-blur sm:p-8">
        <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-slate">{subtitle}</p>}
        <div className="mt-6">{children}</div>
      </div>

      {footer && <div className="mt-6 text-center text-slate">{footer}</div>}
    </main>
  );
}
