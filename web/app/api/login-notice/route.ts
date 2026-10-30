import { NextResponse } from "next/server";
import { sendNotice } from "@/lib/notice-email";

/**
 * Tells the account holder their account was just accessed.
 *
 * Called with `fetch(...).catch(() => {})` right after a successful sign-in, so a failure here can
 * never keep anybody out. Answers 2xx even when nothing was sent.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const result = await sendNotice("login");
  return NextResponse.json(result.body, { status: result.status });
}
