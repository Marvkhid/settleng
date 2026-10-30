import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * The SettleNG identity, in one place. The mark is deliberately simple — a rounded emerald tile
 * with a bold "S" and a single gold dot — so it stays legible at 16px in a browser tab and still
 * looks intentional at 512px on a home screen. `app/icon.svg` (the favicon) is the same artwork;
 * keep the two in sync if the mark ever changes.
 */

/** Brand colours as literals: these must not depend on the CSS theme, which flips in dark mode. */
const EMERALD_DEEP = "#086443";
const EMERALD = "#0f9d6e";
const GOLD = "#f0c272";

export function LogoMark({
  className,
  label,
}: {
  className?: string;
  /** Pass an empty string when the mark sits next to the wordmark, so screen readers hear it once. */
  label?: string;
}) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={cn("size-9 shrink-0", className)}
      role={label === "" ? "presentation" : "img"}
      aria-label={label === "" ? undefined : (label ?? "SettleNG")}
      aria-hidden={label === "" ? true : undefined}
      focusable="false"
    >
      <rect width="64" height="64" rx="15" fill={EMERALD_DEEP} />
      <rect x="1.5" y="1.5" width="61" height="61" rx="13.5" fill="none" stroke={EMERALD} strokeOpacity="0.55" strokeWidth="3" />
      <path
        d="M44.5 22.4c-2.1-3.7-6.5-6-11.7-6-7 0-11.9 3.7-11.9 9.1 0 5 3.8 7.8 10.5 9.1l3.2.6c4.2.8 5.8 1.9 5.8 3.9 0 2.4-2.4 4-6.2 4-4.2 0-7.6-2-9.9-5.5"
        fill="none"
        stroke="#ffffff"
        strokeWidth="5.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="46" cy="45.5" r="4.6" fill={GOLD} />
    </svg>
  );
}

/**
 * Mark + wordmark, used in the marketing header, the app sidebar, the auth pages and the footer.
 * `tone="light"` is for the dark panel surfaces (footer).
 */
export function Wordmark({
  href = "/",
  tone = "default",
  className,
  markClassName,
  size = "md",
}: {
  href?: string;
  tone?: "default" | "light";
  className?: string;
  markClassName?: string;
  size?: "sm" | "md" | "lg";
}) {
  const text = size === "lg" ? "text-3xl" : size === "sm" ? "text-xl" : "text-2xl";
  return (
    <Link
      href={href}
      aria-label="SettleNG home"
      className={cn(
        "inline-flex min-h-11 items-center gap-2.5 font-display font-extrabold tracking-tight",
        tone === "light" ? "text-white" : "text-ink",
        text,
        className,
      )}
    >
      <LogoMark
        label=""
        className={
          size === "sm"
            ? "size-8"
            : size === "lg"
              ? "size-11"
              : "size-9"
        }
      />
      <span>
        Settle<span className="text-emerald">NG</span>
      </span>
    </Link>
  );
}
