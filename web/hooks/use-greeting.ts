"use client";
import { useSyncExternalStore } from "react";
import { greetingFor } from "@/lib/format";

const subscribe = () => () => {};

/**
 * "Good morning / afternoon / evening, {first name}" depends on the visitor's clock, so it can't be
 * baked into the pre-built page. The server snapshot is neutral; after hydration the real greeting
 * appears. Pass the signed-in user's first name (null while loading keeps it neutral).
 */
export function useGreeting(name: string | null | undefined): string {
  return useSyncExternalStore(subscribe, () => greetingFor(name), () => (name ? `Welcome back, ${name}` : "Welcome back"));
}
