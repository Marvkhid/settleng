import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

/** The OTP types Supabase's verification endpoint accepts for an email link. */
type OtpType = "signup" | "invite" | "magiclink" | "recovery" | "email_change" | "email";
const OTP_TYPES: OtpType[] = ["signup", "invite", "magiclink", "recovery", "email_change", "email"];

function otpType(raw: string | null): OtpType {
  return OTP_TYPES.includes(raw as OtpType) ? (raw as OtpType) : "email";
}

/**
 * The one place a Supabase email link (sign-up confirmation, password recovery) is turned into a
 * real session.
 *
 * Two link shapes are accepted, because which one arrives depends on how the Supabase email
 * template is written:
 *   - `?token_hash=...&type=signup` — the template links here directly (recommended).
 *   - `?code=...`                  — Supabase's verify endpoint redirected back here (PKCE).
 *
 * Only a successful verification sets cookies. Visiting this route with no token, or with an
 * expired/already-used one, never grants access: it redirects to the login page with an error code
 * the UI explains, and a resend option.
 */

/** Only same-site relative paths, so `?next=` cannot be used as an open redirect. */
function safeNext(raw: string | null, fallback: string): string {
  if (!raw) return fallback;
  if (!raw.startsWith("/") || raw.startsWith("//")) return fallback;
  return raw;
}

function backToLogin(origin: string, code: string) {
  const url = new URL("/login", origin);
  url.searchParams.set("authError", code);
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const origin = url.origin;
  const type = otpType(url.searchParams.get("type"));
  // A recovery link signs the person in, so sending them to the dashboard would leave them with a
  // new session and the old password. The whole point of that link is the reset form.
  const next = safeNext(
    url.searchParams.get("next"),
    type === "recovery" ? "/reset-password" : "/dashboard",
  );

  // Supabase reports its own failures in the query string (e.g. otp_expired, access_denied).
  const suppliedError = url.searchParams.get("error_code") ?? url.searchParams.get("error");
  if (suppliedError) return backToLogin(origin, suppliedError);

  const tokenHash = url.searchParams.get("token_hash");
  const code = url.searchParams.get("code");

  if (!tokenHash && !code) {
    // No server-visible token. The session may still be in the URL hash (implicit flow), which only
    // the browser can read — hand off to the client page instead of claiming the link failed.
    const complete = new URL("/auth/complete", origin);
    complete.searchParams.set("next", next);
    return NextResponse.redirect(complete);
  }

  const supabase = await supabaseServer();

  try {
    if (tokenHash) {
      const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
      if (error) return backToLogin(origin, error.code ?? "verification_failed");
      return NextResponse.redirect(new URL(next, origin));
    }

    const { error } = await supabase.auth.exchangeCodeForSession(code!);
    if (error) return backToLogin(origin, error.code ?? "verification_failed");
    return NextResponse.redirect(new URL(next, origin));
  } catch {
    return backToLogin(origin, "verification_failed");
  }
}
