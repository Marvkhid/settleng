import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

/**
 * Sends the "your account was created" notification after a sign-up.
 *
 * Deliberately disposable: it never creates, confirms or blocks an account, and every failure path
 * still answers 2xx so the browser can fire it and forget it. With no RESEND_API_KEY configured it
 * reports `sent: false` and does nothing at all.
 *
 * It only ever mails the address of the signed-in caller (taken from the session cookie, never from
 * the request body), so it cannot be used as an open mail relay.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Must match SUPPORT_EMAIL in components/marketing/site-footer.tsx. */
const SUPPORT_EMAIL = "adeniyimarv@gmail.com";

/** One notification per user per ten minutes, per server instance. */
const recent = new Map<string, number>();
const WINDOW_MS = 10 * 60 * 1000;

function body(firstName: string | null) {
  const hello = firstName ? `Hello ${firstName},` : "Hello,";
  return [
    hello,
    "",
    "Your email address was used to create a SettleNG account. If you initiated this registration, no further action is required.",
    "",
    `If you did not, please contact SettleNG support at ${SUPPORT_EMAIL}.`,
    "",
    "— SettleNG",
  ].join("\n");
}

export async function POST() {
  try {
    const supabase = await supabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.email) {
      return NextResponse.json({ sent: false, reason: "not_signed_in" }, { status: 401 });
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ sent: false, reason: "not_configured" });
    }

    const now = Date.now();
    const last = recent.get(user.id) ?? 0;
    if (now - last < WINDOW_MS) {
      return NextResponse.json({ sent: false, reason: "already_sent" });
    }
    recent.set(user.id, now);

    const firstName = (user.user_metadata?.full_name as string | undefined)?.trim().split(/\s+/)[0] ?? null;

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.SIGNUP_NOTICE_FROM || "SettleNG <onboarding@resend.dev>",
        to: [user.email],
        subject: "Your SettleNG account was created",
        text: body(firstName),
      }),
    });

    if (!response.ok) {
      // Log the status only; the provider's message can echo the address.
      console.warn(`signup-notice: provider returned ${response.status}`);
      recent.delete(user.id);
      return NextResponse.json({ sent: false, reason: "provider_error" });
    }

    return NextResponse.json({ sent: true });
  } catch {
    return NextResponse.json({ sent: false, reason: "error" });
  }
}
