"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/_components/auth/AuthProvider";
import { SignInScreen } from "@/app/_components/auth/SignInScreen";
import { driveRoutes } from "@/lib/navigation/routes";

export default function SignInPage() {
  const { isSignedIn } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isSignedIn) router.replace(driveRoutes.dashboard);
  }, [isSignedIn, router]);

  if (isSignedIn) return null;
  return <SignInScreen />;
}
