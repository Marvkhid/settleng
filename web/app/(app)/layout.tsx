"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AuthProvider, useAuth } from "@/components/auth/auth-provider";
import { AppShell } from "@/components/shell/app-shell";

/**
 * Guards the signed-in app: while loading we show nothing extra (the shell handles its own
 * skeletons); once loaded, a user who hasn't finished onboarding is sent to /onboarding.
 */
function RequireBusiness({ children }: { children: React.ReactNode }) {
  const { me, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && me && !me.business) router.replace("/onboarding");
  }, [loading, me, router]);

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
