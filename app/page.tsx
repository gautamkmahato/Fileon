"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "./_components/auth/AuthProvider";
import { SignInScreen } from "./_components/auth/SignInScreen";
import { driveRoutes } from "@/lib/navigation";

export default function HomePage() {
  const { isSignedIn } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isSignedIn) router.replace(driveRoutes.dashboard);
  }, [isSignedIn, router]);

  if (!isSignedIn) return <SignInScreen />;
  return null;
}
