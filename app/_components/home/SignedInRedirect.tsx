"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../auth/AuthProvider";
import { driveRoutes } from "@/lib/navigation";

/** On the public landing page, send signed-in users to the app. */
export function SignedInRedirect() {
  const { isSignedIn } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isSignedIn) router.replace(driveRoutes.dashboard);
  }, [isSignedIn, router]);

  return null;
}
