"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { api, setActiveWorkspace } from "@/lib/api-client";
import type { Me, MemberRole, WorkspaceKind, WorkspaceSummary } from "@/types/api";

const STORAGE_KEY = "settleng.active-workspace";

interface AuthState {
  /** The signed-in user plus their active workspace, once loaded. Null before onboarding finishes. */
  me: Me | null;
  loading: boolean;
  /** The user's first name for the greeting, or a neutral fallback while loading. */
  firstName: string | null;
  businessName: string | null;
  /** Every workspace this user belongs to. */
  workspaces: WorkspaceSummary[];
  activeWorkspaceId: string | null;
  role: MemberRole | null;
  kind: WorkspaceKind;
  /** Switches the active workspace and reloads everything scoped to it. */
  switchWorkspace: (id: string) => void;
  signOut: () => Promise<void>;
  refresh: () => void;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

function firstNameOf(full: string | null | undefined): string | null {
  if (!full) return null;
  const first = full.trim().split(/\s+/)[0];
  return first || null;
}

function savedWorkspace(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // The workspace header must be set before the first request so /auth/me resolves it.
    const saved = savedWorkspace();
    setActiveWorkspace(saved);
    api
      .me()
      .then((m) => {
        if (cancelled) return;
        setMe(m);
        const list = m.workspaces ?? [];
        const resolved =
          list.find((w) => w.id === saved)?.id ?? m.business?.id ?? list[0]?.id ?? null;
        setActiveId(resolved);
        setActiveWorkspace(resolved);
        if (resolved && resolved !== saved) {
          try {
            window.localStorage.setItem(STORAGE_KEY, resolved);
          } catch {
            /* private mode: the header still works for this session */
          }
        }
      })
      .catch(() => { if (!cancelled) setMe(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [tick]);

  const switchWorkspace = useCallback((id: string) => {
    if (!id || id === activeId) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, id);
    } catch {
      /* ignore */
    }
    setActiveWorkspace(id);
    setActiveId(id);
    setLoading(true);
    setTick((t) => t + 1);
  }, [activeId]);

  const signOut = useCallback(async () => {
    await supabase().auth.signOut();
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    setActiveWorkspace(null);
    setMe(null);
    router.replace("/login");
  }, [router]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  const value = useMemo<AuthState>(() => {
    const workspaces = me?.workspaces ?? [];
    const active = workspaces.find((w) => w.id === activeId);
    return {
      me,
      loading,
      firstName: firstNameOf(me?.fullName),
      businessName: me?.business?.name ?? null,
      workspaces,
      activeWorkspaceId: activeId ?? me?.business?.id ?? null,
      role: active?.role ?? me?.role ?? null,
      kind: active?.kind ?? me?.business?.kind ?? "BUSINESS",
      switchWorkspace,
      signOut,
      refresh,
    };
  }, [me, loading, activeId, switchWorkspace, signOut, refresh]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>.");
  return ctx;
}
