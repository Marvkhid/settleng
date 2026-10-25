"use client";
import { useCallback, useSyncExternalStore } from "react";
import { greetingFor } from "@/lib/format";

/**
 * Re-check the time twice a minute so the greeting changes while the dashboard stays open (for
 * example from 11:59 to 12:00), without polling anything on the network.
 */
const subscribe = (onChange: () => void) => {
  const id = setInterval(onChange, 30_000);
  return () => clearInterval(id);
};

/**
 * "Good morning / afternoon / evening, {first name}" depends on the clock, so it can't be baked
 * into the pre-built page. The server snapshot is neutral; after hydration the real greeting
 * appears. Pass the signed-in user's first name (null while loading keeps it neutral).
 */
export function useGreeting(name: string | null | undefined): string {
  const getSnapshot = useCallback(() => greetingFor(name), [name]);
  return useSyncExternalStore(
    subscribe,
    getSnapshot,
    () => (name ? `Welcome back, ${name}` : "Welcome back"),
  );
}
