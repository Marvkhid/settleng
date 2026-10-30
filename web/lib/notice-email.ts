import { supabaseServer } from "@/lib/supabase/server";

/**
 * The two informational emails SettleNG sends: "your account was created" and "your account was
 * just accessed".
 *
 * Neither is security-critical and neither may ever block the action that triggered it, so every
 * failure path returns a result the caller ignores. With no RESEND_API_KEY nothing is sent at all.
 *
 * They can only ever go to the signed-in caller's own address, read from the session cookie rather
 * than the request, so they cannot be used to mail arbitrary people.
 */

/** Must match SUPPORT_EMAIL in components/marketing/site-footer.tsx. */
const SUPPORT_EMAIL = "adeniyimarv@gmail.com";

export type NoticeKind = "signup" | "login";

export interface NoticeResult {
  status: number;
  body: { sent: boolean; reason?: string };
}

/** One message per user per kind per window, per server instance. */
const recent = new Map<string, number>();
const WINDOW_MS: Record<NoticeKind, number> = {
  signup: 10 * 60 * 1000,
  login: 5 * 60 * 1000,
};

function lagosNow(): string {
  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Lagos",
  }).format(new Date());
}

function compose(kind: NoticeKind, firstName: string | null) {
  const hello = firstName ? `Hello ${firstName},` : "Hello,";

  if (kind === "signup") {
    return {
      subject: "Your SettleNG account was created",
      text: [
        hello,
        "",
        "Your email address was used to create a SettleNG account. If you initiated this registration, no further action is required.",
        "",
        `If you did not, please contact SettleNG support at ${SUPPORT_EMAIL}.`,
        "",
        "— SettleNG",
      ].join("\n"),
    };
  }

  return {
    subject: "Your SettleNG account was just accessed",
    text: [
      hello,
      "",
      `Your SettleNG account was accessed on ${lagosNow()} (Lagos time).`,
      "",
      "If this was you, there is nothing to do.",
      "",
      `If it was not you, change your password straight away and contact ${SUPPORT_EMAIL} so we can lock the account.`,
      "",
      "— SettleNG",
    ].join("\n"),
  };
}

export async function sendNotice(kind: NoticeKind): Promise<NoticeResult> {
  try {
    const supabase = await supabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.email) {
      return { status: 401, body: { sent: false, reason: "not_signed_in" } };
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      return { status: 200, body: { sent: false, reason: "not_configured" } };
    }

    const key = `${kind}:${user.id}`;
    const now = Date.now();
    if (now - (recent.get(key) ?? 0) < WINDOW_MS[kind]) {
      return { status: 200, body: { sent: false, reason: "already_sent" } };
    }
    recent.set(key, now);

    const fullName = user.user_metadata?.full_name as string | undefined;
    const firstName = fullName?.trim().split(/\s+/)[0] ?? null;
    const { subject, text } = compose(kind, firstName);

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.SIGNUP_NOTICE_FROM || "SettleNG <onboarding@resend.dev>",
        to: [user.email],
        subject,
        text,
      }),
    });

    if (!response.ok) {
      // The provider's message can echo the address, so only the status is logged.
      console.warn(`${kind}-notice: provider returned ${response.status}`);
      recent.delete(key);
      return { status: 200, body: { sent: false, reason: "provider_error" } };
    }

    return { status: 200, body: { sent: true } };
  } catch {
    return { status: 200, body: { sent: false, reason: "error" } };
  }
}
