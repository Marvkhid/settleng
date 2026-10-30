import Link from "next/link";
import { Mail, MessageCircle, Phone } from "lucide-react";
import { Wordmark } from "@/components/brand/logo";

export const SUPPORT_EMAIL = "adeniyimarv@gmail.com";
export const SUPPORT_PHONE_DISPLAY = "0810 738 7326";
export const SUPPORT_PHONE_TEL = "+2348107387326";
export const SUPPORT_WHATSAPP = "https://wa.me/2348107387326";

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li>
      <Link
        href={href}
        className="link-underline inline-flex min-h-9 items-center text-sm text-white/70 hover:text-white"
      >
        {children}
      </Link>
    </li>
  );
}

function Column({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-xs font-bold uppercase tracking-[0.16em] text-white/45">{title}</h2>
      <ul className="mt-3 space-y-1">{children}</ul>
    </div>
  );
}

/**
 * Public site footer. Contact details here are the single source of truth for the app: the support
 * page imports the same constants, so the email and phone number can never drift apart.
 */
export function SiteFooter() {
  return (
    <footer className="panel-dark relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-emerald/20 blur-3xl"
      />
      <div className="relative mx-auto w-full max-w-6xl px-5 py-14 md:px-8">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_2.6fr]">
          <div>
            <Wordmark tone="light" />
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-white/70">
              A free money tracker for Nigerian traders and small business owners. Record sales and
              expenses, review your records, and see how your business is moving.
            </p>
            <p className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/80">
              Free to use. No subscription fees.
            </p>
          </div>

          <div className="grid gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-[1fr_1.1fr_1.5fr_1fr]">
            <Column title="SettleNG">
              <FooterLink href="/">Home</FooterLink>
              <FooterLink href="/#how-it-works">How it works</FooterLink>
              <FooterLink href="/#features">What it does</FooterLink>
              <FooterLink href="/#who-it-is-for">Who it&apos;s for</FooterLink>
            </Column>

            <Column title="About">
              <FooterLink href="/about">About SettleNG</FooterLink>
              <FooterLink href="/about#problem">The problem we solve</FooterLink>
              <FooterLink href="/about#commitment">Our commitment</FooterLink>
            </Column>

            <Column title="Support">
              <FooterLink href="/support#complaints">Complaints &amp; feedback</FooterLink>
              <FooterLink href="/support">Contact &amp; support</FooterLink>
              <li>
                <a
                  href={`mailto:${SUPPORT_EMAIL}`}
                  className="link-underline inline-flex min-h-9 max-w-full items-center gap-2 text-sm text-white/70 hover:text-white"
                >
                  <Mail className="size-4 shrink-0" aria-hidden />
                  <span className="break-all">{SUPPORT_EMAIL}</span>
                </a>
              </li>
              <li>
                <a
                  href={`tel:${SUPPORT_PHONE_TEL}`}
                  className="link-underline inline-flex min-h-9 items-center gap-2 text-sm text-white/70 hover:text-white"
                >
                  <Phone className="size-4 shrink-0" aria-hidden /> {SUPPORT_PHONE_DISPLAY}
                </a>
              </li>
              <li>
                <a
                  href={SUPPORT_WHATSAPP}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="link-underline inline-flex min-h-9 items-center gap-2 text-sm text-white/70 hover:text-white"
                >
                  <MessageCircle className="size-4 shrink-0" aria-hidden /> WhatsApp
                </a>
              </li>
            </Column>

            <Column title="Legal">
              <FooterLink href="/privacy">Privacy Policy</FooterLink>
              <FooterLink href="/terms">Terms of Service</FooterLink>
              <FooterLink href="/privacy#cookies">Cookies &amp; storage</FooterLink>
            </Column>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-white/12 pt-6 text-sm text-white/55 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} SettleNG. Built by Marvel Adeniyi.</p>
          <p className="text-white/45">
            SettleNG records what you enter. It does not connect to banks, hold money or process
            payments.
          </p>
        </div>
      </div>
    </footer>
  );
}
