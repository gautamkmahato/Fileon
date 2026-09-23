"use client";

import { useEffect, useMemo, useState } from "react";
import type { CleanupKindMeta, CleanupDetectorKind } from "@/lib/cleanup/kinds";
import type { NearDupFamily, StaleWindow } from "@/lib/cleanup/types";
import { findingsForKind, type CleanupFinding, type CleanupGroup } from "@/lib/cleanup/types";
import { useCleanupScan } from "@/lib/cleanup/useCleanupScan";
import { useCleanupStore } from "@/lib/cleanup/store";
import { useSelectionStore } from "@/lib/stores";
import { CleanupScanBanner } from "./CleanupScanBanner";
import { CleanupFindingsList } from "./CleanupFindingsList";

const STALE_CHIPS: { id: StaleWindow; label: string }[] = [
  { id: "6m", label: "6 months" },
  { id: "1y", label: "1 year" },
  { id: "2y", label: "2 years" },
];

const NEAR_CHIPS: { id: NearDupFamily | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "pdf", label: "PDFs" },
  { id: "document", label: "Documents" },
  { id: "image", label: "Images" },
];

export function CleanupDetectorView({
  kind,
  meta,
}: {
  kind: CleanupDetectorKind;
  meta: CleanupKindMeta;
}) {
  const scan = useCleanupScan();
  const [staleWindow, setStaleWindow] = useState<StaleWindow>("1y");
  const [nearFamily, setNearFamily] = useState<NearDupFamily | "all">("all");
  const [dupMode, setDupMode] = useState<"exact" | "renamed">("exact");

  const analysis = scan.analysis;

  const { groups, findings } = useMemo(() => {
    if (!analysis) return { groups: [] as CleanupGroup[], findings: [] as CleanupFinding[] };

    if (kind === "stale") {
      const list =
        staleWindow === "6m" ? analysis.stale6m
        : staleWindow === "2y" ? analysis.stale2y
        : analysis.stale1y;
      return { groups: [], findings: list };
    }

    if (kind === "duplicates") {
      const groups = dupMode === "renamed" ? analysis.sameContentDifferentNames : analysis.duplicateGroups;
      return { groups, findings: [] };
    }

    if (kind === "near-duplicates") {
      const groups = nearFamily === "all"
        ? analysis.nearDuplicateGroups
        : analysis.nearDuplicateGroups.filter((g) => g.family === nearFamily);
      return { groups, findings: [] };
    }

    return findingsForKind(analysis, kind);
  }, [analysis, kind, staleWindow, nearFamily, dupMode]);

  const visibleIds = useMemo(() => {
    if (groups.length) {
      const ids: string[] = [];
      const seen = new Set<string>();
      for (const group of groups) {
        for (const file of group.files) {
          if (seen.has(file.id)) continue;
          seen.add(file.id);
          ids.push(file.id);
        }
      }
      return ids;
    }
    return findings.map((f) => f.file.id);
  }, [groups, findings]);

  useEffect(() => {
    useCleanupStore.getState().setVisibleIds(visibleIds);
    return () => {
      if (useCleanupStore.getState().visibleIds === visibleIds) {
        useCleanupStore.getState().setVisibleIds([]);
      }
    };
  }, [visibleIds]);

  const count = groups.length ? visibleIds.length : findings.length;

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-2">
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
          {meta.label}
        </h1>
        <p className="text-sm text-zinc-500 mt-1">{meta.description}</p>
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

      {kind === "stale" && (
        <ChipRow
          items={STALE_CHIPS}
          value={staleWindow}
          onChange={setStaleWindow}
        />
      )}
      {kind === "near-duplicates" && (
        <ChipRow
          items={NEAR_CHIPS}
          value={nearFamily}
          onChange={setNearFamily}
        />
      )}
      {kind === "duplicates" && (
        <ChipRow
          items={[
            { id: "exact", label: "Exact copies" },
            { id: "renamed", label: "Same content, different names" },
          ]}
          value={dupMode}
          onChange={setDupMode}
        />
      )}

      <p className="text-xs text-zinc-500 mb-3 tabular-nums flex items-center justify-between gap-3">
        <span>
          {scan.status === "scanning" || scan.status === "loading" ? "Scanning…" : `${count.toLocaleString()} found`}
          {kind === "duplicates" && analysis && dupMode === "exact" && (
            <span> · {analysis.counts.duplicateGroups} sets</span>
          )}
        </span>
        {count > 0 && (
          <button
            type="button"
            onClick={() => {
              if (!visibleIds.length) return;
              useSelectionStore.getState().setSelection(visibleIds, visibleIds[visibleIds.length - 1] ?? null);
            }}
            className="text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            Select all
          </button>
        )}
      </p>

      <CleanupFindingsList
        findings={findings}
        groups={groups}
        emptyLabel={scan.status === "scanning" || scan.status === "loading" ? "Loading…" : "No matches in this scan"}
      />
    </div>
  );
}

function ChipRow<T extends string>({
  items,
  value,
  onChange,
}: {
  items: { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5 mb-4">
      {items.map((item) => {
        const active = item.id === value;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
              active
                ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900"
                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700"
            }`}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
