"use client";

import { useAuth } from "../_components/auth/AuthProvider";
import { SignInScreen } from "../_components/auth/SignInScreen";
import { AppShell } from "../_components/layout/AppShell";
import { AppProviders } from "./providers";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { isSignedIn } = useAuth();
  if (!isSignedIn) return <SignInScreen />;
  return (
    <AppProviders>
      <AppShell>{children}</AppShell>
    </AppProviders>
  );
}
