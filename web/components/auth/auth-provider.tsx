"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { api } from "@/lib/api-client";
import type { Me } from "@/types/api";

interface AuthState {
  /** The signed-in user plus their business, once loaded. Null before onboarding finishes. */
  me: Me | null;
  loading: boolean;
  /** The user's first name for the greeting, or a neutral fallback while loading. */
  firstName: string | null;
  businessName: string | null;
  signOut: () => Promise<void>;
  refresh: () => void;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

function firstNameOf(full: string | null | undefined): string | null {
  if (!full) return null;
  const first = full.trim().split(/\s+/)[0];
  return first || null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    // `loading` already starts true; refetches (tick) are silent background refreshes so the
    // existing UI stays visible instead of flashing a skeleton.
    api
      .me()
      .then((m) => { if (!cancelled) setMe(m); })
      .catch(() => { if (!cancelled) setMe(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [tick]);

  const signOut = useCallback(async () => {
    await supabase().auth.signOut();
    setMe(null);
    router.replace("/login");
  }, [router]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  const value = useMemo<AuthState>(
    () => ({
      me,
      loading,
      firstName: firstNameOf(me?.fullName),
      businessName: me?.business?.name ?? null,
      signOut,
      refresh,
    }),
    [me, loading, signOut, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>.");
  return ctx;
}
