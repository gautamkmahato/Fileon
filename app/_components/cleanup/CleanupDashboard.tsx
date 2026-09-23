"use client";

import { useEffect } from "react";
import Link from "next/link";
import { driveRoutes } from "@/lib/navigation";
import { CLEANUP_KIND_META, type CleanupKind } from "@/lib/cleanup/kinds";
import type { CleanupAnalysis } from "@/lib/cleanup/types";
import { useCleanupScan } from "@/lib/cleanup/useCleanupScan";
import { CleanupScanBanner } from "./CleanupScanBanner";
import { CleanupFindingsList } from "./CleanupFindingsList";
import { useCleanupStore } from "@/lib/cleanup/store";
import { useSelectionStore } from "@/lib/stores";

const DASHBOARD_CARDS: { kind: CleanupKind; count: (a: CleanupAnalysis) => number }[] = [
  { kind: "duplicates", count: (a) => a.counts.duplicateFiles },
  { kind: "near-duplicates", count: (a) => a.counts.nearDuplicateFiles },
  { kind: "stale", count: (a) => a.counts.stale1y },
  { kind: "unused", count: (a) => a.counts.unused },
  { kind: "empty-folders", count: (a) => a.counts.emptyFolders },
  { kind: "broken-shortcuts", count: (a) => a.counts.brokenShortcuts },
  { kind: "dead", count: (a) => a.counts.dead },
  { kind: "unorganized", count: (a) => a.counts.unorganized },
  { kind: "inaccessible", count: (a) => a.counts.inaccessible },
  { kind: "orphaned", count: (a) => a.counts.orphaned },
  { kind: "duplicate-folders", count: (a) => a.counts.duplicateFolders },
  { kind: "redundant", count: (a) => a.counts.redundant },
];

function scoreColor(score: number): string {
  if (score >= 85) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 65) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

export function CleanupDashboard() {
  const scan = useCleanupScan();

  const analysis = scan.analysis;
  const score = analysis?.health.score ?? null;

  useEffect(() => {
    const ids = analysis?.recommendations.map((f) => f.file.id) ?? [];
    useCleanupStore.getState().setVisibleIds(ids);
    return () => {
      useCleanupStore.getState().setVisibleIds([]);
    };
  }, [analysis]);

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-2">
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
          Drive health
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          Duplicates, stale files, unused clutter, and structure issues — in one place.
        </p>
      </div>

      <CleanupScanBanner
        status={scan.status}
        listed={scan.listed}
        phase={scan.phase}
        truncated={scan.truncated}
        error={scan.error}
        scannedAt={scan.scannedAt}
        memoryOnly={scan.memoryOnly}
        onRefresh={scan.refresh}
      />

      <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-4 mb-6">
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 flex flex-col items-center justify-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-400">Health score</p>
          <p className={`text-5xl font-semibold tabular-nums mt-2 ${score == null ? "text-zinc-300" : scoreColor(score)}`}>
            {score == null ? "—" : score}
            <span className="text-lg text-zinc-400 font-medium">/100</span>
          </p>
          {analysis && (
            <p className="text-xs text-zinc-500 mt-2 text-center">
              {analysis.counts.duplicateFiles.toLocaleString()} duplicate candidates ·{" "}
              {analysis.counts.stale1y.toLocaleString()} stale ·{" "}
              {analysis.counts.untagged.toLocaleString()} untagged ·{" "}
              {analysis.counts.brokenShortcuts.toLocaleString()} broken shortcuts
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-400 mb-3">
            Score breakdown
          </p>
          <ul className="space-y-2">
            {(analysis?.health.breakdown ?? []).map((item) => (
              <li key={item.label} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-zinc-700 dark:text-zinc-300">{item.label}</span>
                <span className="text-zinc-500 tabular-nums">
                  {item.count.toLocaleString()}
                  {item.penalty > 0 && (
                    <span className="text-zinc-400 ml-2">−{item.penalty}</span>
                  )}
                </span>
              </li>
            ))}
            {!analysis && (
              <li className="text-sm text-zinc-400">
                {scan.status === "scanning" || scan.status === "loading" ? "Scoring after scan…" : "Run a scan to see Drive health."}
              </li>
            )}
          </ul>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 mb-8">
        {DASHBOARD_CARDS.map(({ kind, count }) => {
          const meta = CLEANUP_KIND_META[kind];
          const Icon = meta.icon;
          const n = analysis ? count(analysis) : 0;
          return (
            <Link
              key={kind}
              href={driveRoutes.cleanupKind(kind)}
              className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors"
            >
              <div className="flex items-center gap-2 text-zinc-500 mb-2">
                <Icon className="w-4 h-4" strokeWidth={1.75} />
                <span className="text-xs font-medium truncate">{meta.label}</span>
              </div>
              <p className="text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                { (scan.status === "scanning" || scan.status === "loading") && !analysis ? "…" : n.toLocaleString()}
              </p>
            </Link>
          );
        })}
      </div>

      <section>
        <div className="flex items-end justify-between gap-3 mb-3">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Clean these first
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              Prioritized by size, age, duplicates, and activity. Review before deleting.
            </p>
          </div>
          {(analysis?.recommendations.length ?? 0) > 0 && (
            <button
              type="button"
              onClick={() => {
                const ids = analysis!.recommendations.map((f) => f.file.id);
                useSelectionStore.getState().setSelection(ids, ids[ids.length - 1] ?? null);
              }}
              className="text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100"
            >
              Select all
            </button>
          )}
        </div>
        <CleanupFindingsList
          findings={analysis?.recommendations ?? []}
          emptyLabel={scan.status === "scanning" || scan.status === "loading" ? "Looking for cleanup candidates…" : "Nothing urgent right now"}
        />
      </section>
    </div>
  );
}
