"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AuthProvider, useAuth } from "@/components/auth/auth-provider";
import { AppShell } from "@/components/shell/app-shell";

/**
 * Guards the signed-in app. A user who has not finished onboarding is sent to /onboarding, and the
 * app's pages are not rendered until a workspace exists — otherwise every page fires data requests
 * that have no workspace to scope to, which is both pointless and noisy.
 */
function RequireBusiness({ children }: { children: React.ReactNode }) {
  const { me, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && me && !me.business) router.replace("/onboarding");
  }, [loading, me, router]);

  if (loading) return null;
  if (!me?.business) return null;
  return <>{children}</>;
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <RequireBusiness>
        <AppShell>{children}</AppShell>
      </RequireBusiness>
    </AuthProvider>
  );
}
