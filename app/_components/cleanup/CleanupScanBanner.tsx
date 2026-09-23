"use client";

import { Loader2, RefreshCw } from "lucide-react";
import { CLEANUP_SCAN_CAP } from "@/lib/cleanup/scan";

export function CleanupScanBanner({
  status,
  listed,
  phase,
  truncated,
  error,
  scannedAt,
  memoryOnly,
  onRefresh,
}: {
  status: string;
  listed: number;
  phase: string | null;
  truncated: boolean;
  error: string | null;
  scannedAt?: number;
  memoryOnly?: boolean;
  onRefresh: () => void;
}) {
  const phaseLabel =
    phase === "shortcuts" ? "Checking shortcuts…"
    : phase === "folders" ? "Checking empty folders…"
    : phase === "syncing" ? "Updating from Drive…"
    : status === "loading" ? "Loading saved results…"
    : "Scanning Drive…";

  const busy = status === "scanning" || status === "loading" || phase === "syncing";

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
      <div className="min-w-0">
        {busy && (
          <p className="text-sm text-zinc-500 flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin shrink-0" />
            {phaseLabel}
            {listed > 0 && status === "scanning" && (
              <span className="tabular-nums">{listed.toLocaleString()} files</span>
            )}
          </p>
        )}
        {status === "error" && (
          <p className="text-sm text-red-600 dark:text-red-400">{error || "Scan failed"}</p>
        )}
        {status === "ready" && !busy && (
          <p className="text-xs text-zinc-500">
            {scannedAt ? `Last updated ${formatSynced(scannedAt)}` : "Saved locally"}
            {truncated && (
              <span className="text-amber-700 dark:text-amber-400">
                {" "}· Partial index (cap {CLEANUP_SCAN_CAP.toLocaleString()})
              </span>
            )}
            {memoryOnly && " · Storage unavailable this session"}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={onRefresh}
        disabled={busy}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${status === "scanning" ? "animate-spin" : ""}`} />
        Rescan
      </button>
    </div>
  );
}

function formatSynced(ms: number): string {
  const diff = Date.now() - ms;
  if (!Number.isFinite(diff) || diff < 30_000) return "just now";
  const mins = Math.round(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  return new Date(ms).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}
