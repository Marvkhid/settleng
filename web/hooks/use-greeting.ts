"use client";
import { useSyncExternalStore } from "react";
import { greeting } from "@/lib/format";

const subscribe = () => () => {};

/**
 * "Good morning / afternoon / evening" depends on the visitor's clock, so it can't be baked into the
 * pre-built page. The server snapshot is neutral; after hydration the real greeting appears.
 */
export function useGreeting(): string {
  return useSyncExternalStore(subscribe, () => greeting(), () => "Welcome back");
}
