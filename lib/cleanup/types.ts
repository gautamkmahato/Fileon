import type { DriveFile } from "@/lib/drive/drive";
import type { CleanupDetectorKind } from "./kinds";

export type NearDupFamily = "pdf" | "document" | "image" | "other";

export interface CleanupGroup {
  id: string;
  label: string;
  reason: string;
  family?: NearDupFamily;
  files: DriveFile[];
}

export interface CleanupFinding {
  file: DriveFile;
  reason: string;
}

export interface CleanupCounts {
  duplicateFiles: number;
  duplicateGroups: number;
  sameContentDifferentNames: number;
  nearDuplicateFiles: number;
  nearDuplicateGroups: number;
  dead: number;
  stale6m: number;
  stale1y: number;
  stale2y: number;
  unused: number;
  emptyFolders: number;
  brokenShortcuts: number;
  inaccessible: number;
  orphaned: number;
  unorganized: number;
  duplicateFolders: number;
  redundant: number;
  untagged: number;
}

export interface HealthBreakdownItem {
  label: string;
  count: number;
  penalty: number;
}

export interface CleanupHealth {
  score: number;
  breakdown: HealthBreakdownItem[];
}

export interface CleanupAnalysis {
  duplicateGroups: CleanupGroup[];
  sameContentDifferentNames: CleanupGroup[];
  nearDuplicateGroups: CleanupGroup[];
  dead: CleanupFinding[];
  stale6m: CleanupFinding[];
  stale1y: CleanupFinding[];
  stale2y: CleanupFinding[];
  unused: CleanupFinding[];
  emptyFolders: CleanupFinding[];
  brokenShortcuts: CleanupFinding[];
  inaccessible: CleanupFinding[];
  orphaned: CleanupFinding[];
  unorganized: CleanupFinding[];
  duplicateFolders: CleanupGroup[];
  redundant: CleanupFinding[];
  recommendations: CleanupFinding[];
  counts: CleanupCounts;
  health: CleanupHealth;
}

export interface CleanupScanContext {
  now: number;
  inboxIds: Set<string>;
  taggedIds: Set<string>;
  brokenTargetIds: Set<string>;
  verifiedEmptyFolderIds: Set<string>;
  inaccessibleIds: Set<string>;
  truncated: boolean;
}

export type StaleWindow = "6m" | "1y" | "2y";

export function findingsForKind(
  analysis: CleanupAnalysis,
  kind: CleanupDetectorKind,
): { files: DriveFile[]; groups: CleanupGroup[]; findings: CleanupFinding[] } {
  switch (kind) {
    case "duplicates":
      return { files: flattenGroups(analysis.duplicateGroups), groups: analysis.duplicateGroups, findings: [] };
    case "near-duplicates":
      return { files: flattenGroups(analysis.nearDuplicateGroups), groups: analysis.nearDuplicateGroups, findings: [] };
    case "duplicate-folders":
      return { files: flattenGroups(analysis.duplicateFolders), groups: analysis.duplicateFolders, findings: [] };
    case "redundant":
      return { files: analysis.redundant.map((f) => f.file), groups: [], findings: analysis.redundant };
    case "dead":
      return { files: analysis.dead.map((f) => f.file), groups: [], findings: analysis.dead };
    case "stale":
      return { files: analysis.stale1y.map((f) => f.file), groups: [], findings: analysis.stale1y };
    case "unused":
      return { files: analysis.unused.map((f) => f.file), groups: [], findings: analysis.unused };
    case "empty-folders":
      return { files: analysis.emptyFolders.map((f) => f.file), groups: [], findings: analysis.emptyFolders };
    case "broken-shortcuts":
      return { files: analysis.brokenShortcuts.map((f) => f.file), groups: [], findings: analysis.brokenShortcuts };
    case "inaccessible":
      return { files: analysis.inaccessible.map((f) => f.file), groups: [], findings: analysis.inaccessible };
    case "orphaned":
      return { files: analysis.orphaned.map((f) => f.file), groups: [], findings: analysis.orphaned };
    case "unorganized":
      return { files: analysis.unorganized.map((f) => f.file), groups: [], findings: analysis.unorganized };
    default:
      return { files: [], groups: [], findings: [] };
  }
}

function flattenGroups(groups: CleanupGroup[]): DriveFile[] {
  const seen = new Set<string>();
  const out: DriveFile[] = [];
  for (const group of groups) {
    for (const file of group.files) {
      if (seen.has(file.id)) continue;
      seen.add(file.id);
      out.push(file);
    }
  }
  return out;
}
