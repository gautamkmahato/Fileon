"use client";

import type { ShareLinkEffectiveStatus } from "@/lib/shares";

export function StatusPill({ status }: { status: ShareLinkEffectiveStatus }) {
  const cls =
    status === "active"
      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
      : status === "expired"
      ? "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
      : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300";
  const label = status === "active" ? "Active" : status === "expired" ? "Expired" : "Revoked";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${cls}`}>
      {label}
    </span>
  );
}
