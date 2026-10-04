"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { AppLogo } from "@/app/_components/brand/AppLogo";
import {
  anyAccessSetupCompleted,
  hasAnyGrantedFile,
  hasCompletedAccessSetup,
  markAccessSetupDone,
} from "@/lib/drive/access";
import { useAuth } from "../auth/AuthProvider";
import { DriveAccessSetup } from "./DriveAccessSetup";

type GateStatus = "checking" | "setup" | "ready";

/**
 * First-run step for the `drive.file` scope. Shows the guided picker when the
 * account has not granted any files yet; otherwise renders the app.
 */
export function DriveAccessGate({ children }: { children: React.ReactNode }) {
  const { token, profile } = useAuth();
  const userId = profile?.sub ?? null;
  const [status, setStatus] = useState<GateStatus>(() =>
    anyAccessSetupCompleted() ? "ready" : "checking"
  );

  useEffect(() => {
    if (!token) return;
    if (userId && hasCompletedAccessSetup(userId)) {
      setStatus("ready");
      return;
    }
    // Decide once. The probe does not need the profile, so a slow or failed
    // profile fetch cannot leave the user on the spinner.
    if (status !== "checking") return;
    let cancelled = false;
    hasAnyGrantedFile(token)
      .then((granted) => {
        if (cancelled) return;
        if (granted) {
          if (userId) markAccessSetupDone(userId);
          setStatus("ready");
        } else {
          setStatus("setup");
        }
      })
      .catch(() => {
        if (!cancelled) setStatus("ready");
      });
    return () => {
      cancelled = true;
    };
  }, [token, userId, status]);

  if (status === "ready") return <>{children}</>;

  if (status === "checking") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <Loader2 className="w-5 h-5 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-zinc-50 via-zinc-50 to-blue-50 dark:from-zinc-950 dark:via-zinc-950 dark:to-zinc-900">
      <header className="px-6 py-5">
        <AppLogo size="sm" showName nameClassName="font-semibold tracking-tight text-zinc-900 dark:text-zinc-100" />
      </header>
      <main className="flex-1 flex items-center justify-center p-6">
        <DriveAccessSetup
          token={token}
          mode="onboarding"
          onFinished={() => {
            if (userId) markAccessSetupDone(userId);
            setStatus("ready");
          }}
        />
      </main>
    </div>
  );
}
