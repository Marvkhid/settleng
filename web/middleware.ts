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
  // Run on everything except Next internals, static assets and files with an extension.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2?)$).*)"],
};
