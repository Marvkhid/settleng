import type { MetadataRoute } from "next";
import { PRIVATE_ROUTES, SITE_URL } from "@/lib/site";

/**
 * robots.txt. The marketing pages are open; anything behind a sign-in is not, because those URLs
 * only ever show one person's own books and indexing them wastes crawl budget (and invites
 * accidental sharing through search results).
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [...PRIVATE_ROUTES.map((p) => `${p}/`), ...PRIVATE_ROUTES, "/auth/", "/api/"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
