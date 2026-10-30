import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Supabase auth middleware: runs on every request, refreshes the session cookie, and guards the
 * app routes (/dashboard and everything under the (app) group). Unauthenticated visitors are sent
 * to /login; signed-in users on an auth page go to /dashboard.
 */
export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  // Run on everything except Next internals, static assets, the auth callback route (it sets its own
  // session cookies), the generated metadata routes (icons, share image, sitemap, robots, manifest)
  // and files with an extension. Those are fetched by crawlers and social bots, and there is no
  // session to refresh for them.
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|auth/|icon\\.svg|apple-icon|opengraph-image|manifest\\.webmanifest|robots\\.txt|sitemap\\.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)",
  ],
};
