import { NextResponse } from "next/server";
import { sendNotice } from "@/lib/notice-email";

/**
 * Sends the "your account was created" notification after a successful sign-up.
 *
 * Deliberately disposable: it never creates, confirms or blocks an account, and every failure path
 * still answers 2xx so the browser can fire it and forget it. With no RESEND_API_KEY configured it
 * reports `sent: false` and does nothing at all.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const result = await sendNotice("signup");
  return NextResponse.json(result.body, { status: result.status });
}
