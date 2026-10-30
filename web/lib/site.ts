/**
 * One source of truth for the site's public identity. Everything that has to be absolute — canonical
 * URLs, Open Graph URLs, the sitemap, robots.txt — reads from here, so changing the domain is a
 * single edit (or the NEXT_PUBLIC_SITE_URL environment variable).
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://settleng.vercel.app"
).replace(/\/+$/, "");

export const SITE_NAME = "SettleNG";

export const SITE_TITLE = "SettleNG — free money tracker for Nigerian traders";

export const SITE_DESCRIPTION =
  "Free money tracking for Nigerian traders and small businesses: record sales and expenses, track customer debts, send invoices and see reports. No subscription, no bank connection.";

/** Keywords used in metadata only; page copy stays natural. */
export const SITE_KEYWORDS = [
  "free financial tracking app",
  "money management for traders",
  "business expense tracker Nigeria",
  "financial tracking for small businesses",
  "bookkeeping app for small business Nigeria",
  "customer debt tracker",
  "sales and expense tracker Nigeria",
  "fintech startups in Nigeria",
];

/** Public pages that belong in the sitemap. Signed-in app routes are excluded on purpose. */
export const PUBLIC_ROUTES: { path: string; priority: number; changeFrequency: "weekly" | "monthly" }[] = [
  { path: "/", priority: 1, changeFrequency: "weekly" },
  { path: "/about", priority: 0.7, changeFrequency: "monthly" },
  { path: "/support", priority: 0.6, changeFrequency: "monthly" },
  { path: "/signup", priority: 0.8, changeFrequency: "monthly" },
  { path: "/login", priority: 0.4, changeFrequency: "monthly" },
  { path: "/privacy", priority: 0.3, changeFrequency: "monthly" },
  { path: "/terms", priority: 0.3, changeFrequency: "monthly" },
];

/** Routes that must never be indexed: one person's own financial records live behind them. */
export const PRIVATE_ROUTES = [
  "/dashboard",
  "/transactions",
  "/invoices",
  "/customers",
  "/reports",
  "/reconciliation",
  "/settings",
  "/onboarding",
];
