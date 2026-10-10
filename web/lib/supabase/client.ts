"use client";
import { createBrowserClient } from "@supabase/ssr";

/**
 * Supabase client for client components (browser). Used to read the session, sign in/out, and grab
 * the access token we attach to every API call. Falls back to the published env vars so a missing
 * local file still produces a working client (it will just fail to reach Supabase if unset).
 */
export function supabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
