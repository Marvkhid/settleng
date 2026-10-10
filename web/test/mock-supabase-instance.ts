import type { MockSupabase } from "./mock-supabase";

let current: MockSupabase | null = null;

export function setSupabaseInstance(next: MockSupabase): void {
  current = next;
}

export function getSupabaseInstance(): MockSupabase {
  if (!current) throw new Error("Supabase mock not configured");
  return current;
}
