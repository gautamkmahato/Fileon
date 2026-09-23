import type { LucideIcon } from "lucide-react";
import {
  Ban,
  Clock,
  Copy,
  CopyMinus,
  FileStack,
  FileX,
  FolderOpen,
  FolderX,
  Ghost,
  HeartPulse,
  Layers,
  Link2Off,
  FolderTree,
} from "lucide-react";

/** Detector pages plus the overview dashboard. */
export const CLEANUP_KINDS = [
  "overview",
  "duplicates",
  "near-duplicates",
  "dead",
  "stale",
  "unused",
  "empty-folders",
  "broken-shortcuts",
  "inaccessible",
  "orphaned",
  "unorganized",
  "duplicate-folders",
  "redundant",
] as const;

export type CleanupKind = (typeof CLEANUP_KINDS)[number];

export type CleanupDetectorKind = Exclude<CleanupKind, "overview">;

export function isCleanupKind(value: string | null | undefined): value is CleanupKind {
  return !!value && (CLEANUP_KINDS as readonly string[]).includes(value);
}

export interface CleanupKindMeta {
  id: CleanupKind;
  label: string;
  description: string;
  icon: LucideIcon;
  group: "overview" | "duplicates" | "inactive" | "structure";
}

export const CLEANUP_KIND_META: Record<CleanupKind, CleanupKindMeta> = {
  overview: {
    id: "overview",
    label: "Overview",
    description: "Health score, counts, and what to clean first",
    icon: HeartPulse,
    group: "overview",
  },
  duplicates: {
    id: "duplicates",
    label: "Duplicates",
    description: "Exact copies, including same content with different names",
    icon: Copy,
    group: "duplicates",
  },
  "near-duplicates": {
    id: "near-duplicates",
    label: "Near-duplicates",
    description: "Similar PDFs, documents, images, and versioned copies",
    icon: FileStack,
    group: "duplicates",
  },
  "duplicate-folders": {
    id: "duplicate-folders",
    label: "Duplicate folders",
    description: "Folders with overlapping contents",
    icon: Layers,
    group: "duplicates",
  },
  redundant: {
    id: "redundant",
    label: "Redundant files",
    description: "Older copies that a newer file likely replaces",
    icon: CopyMinus,
    group: "duplicates",
  },
  dead: {
    id: "dead",
    label: "Dead files",
    description: "Not opened or modified for a very long time",
    icon: Ghost,
    group: "inactive",
  },
  stale: {
    id: "stale",
    label: "Stale files",
    description: "Inactive for 6 months, 1 year, or 2 years",
    icon: Clock,
    group: "inactive",
  },
  unused: {
    id: "unused",
    label: "Unused files",
    description: "No recent activity and no ongoing relevance",
    icon: FileX,
    group: "inactive",
  },
  "empty-folders": {
    id: "empty-folders",
    label: "Empty folders",
    description: "Folders that contain no files",
    icon: FolderX,
    group: "structure",
  },
  "broken-shortcuts": {
    id: "broken-shortcuts",
    label: "Broken shortcuts",
    description: "Shortcuts pointing at deleted or inaccessible files",
    icon: Link2Off,
    group: "structure",
  },
  inaccessible: {
    id: "inaccessible",
    label: "Inaccessible files",
    description: "Files you can see but can no longer open properly",
    icon: Ban,
    group: "structure",
  },
  orphaned: {
    id: "orphaned",
    label: "Orphaned files",
    description: "Disconnected from your current folder structure",
    icon: FolderTree,
    group: "structure",
  },
  unorganized: {
    id: "unorganized",
    label: "Unorganized files",
    description: "Sitting in My Drive root instead of a folder",
    icon: FolderOpen,
    group: "structure",
  },
};

export const CLEANUP_NAV_ORDER: CleanupKind[] = [
  "overview",
  "duplicates",
  "near-duplicates",
  "duplicate-folders",
  "redundant",
  "dead",
  "stale",
  "unused",
  "empty-folders",
  "broken-shortcuts",
  "inaccessible",
  "orphaned",
  "unorganized",
];

export const CLEANUP_NAV_GROUPS: { id: string; label: string; kinds: CleanupKind[] }[] = [
  { id: "overview", label: "", kinds: ["overview"] },
  {
    id: "duplicates",
    label: "Duplicates",
    kinds: ["duplicates", "near-duplicates", "duplicate-folders", "redundant"],
  },
  { id: "inactive", label: "Inactive", kinds: ["dead", "stale", "unused"] },
  {
    id: "structure",
    label: "Structure",
    kinds: ["empty-folders", "broken-shortcuts", "inaccessible", "orphaned", "unorganized"],
  },
];
