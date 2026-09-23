import type { DriveFile } from "@/lib/drive/drive";

export interface Filters {
  type: TypeFilter;
  modified: ModifiedFilter;
  source: SourceFilter;
  sharedOnly?: boolean;
  untaggedOnly?: boolean;
}

export type TypeFilter = "all" | "folder" | "document" | "spreadsheet" | "presentation" | "pdf" | "image" | "video" | "audio" | "archive" | "other";
export type ModifiedFilter = "any" | "today" | "this-week" | "this-month" | "this-year";
export type SourceFilter = "all" | "google" | "ms-office" | "media";

export const DEFAULT_FILTERS: Filters = {
  type: "all",
  modified: "any",
  source: "all",
};

export const TYPE_OPTIONS: Array<{ value: TypeFilter; label: string }> = [
  { value: "all", label: "All types" },
  { value: "folder", label: "Folders" },
  { value: "document", label: "Documents" },
  { value: "spreadsheet", label: "Spreadsheets" },
  { value: "presentation", label: "Presentations" },
  { value: "pdf", label: "PDFs" },
  { value: "image", label: "Images" },
  { value: "video", label: "Videos" },
  { value: "audio", label: "Audio" },
  { value: "archive", label: "Archives" },
  { value: "other", label: "Other" },
];

export const MODIFIED_OPTIONS: Array<{ value: ModifiedFilter; label: string }> = [
  { value: "any", label: "Any time" },
  { value: "today", label: "Today" },
  { value: "this-week", label: "This week" },
  { value: "this-month", label: "This month" },
  { value: "this-year", label: "This year" },
];

export const SOURCE_OPTIONS: Array<{ value: SourceFilter; label: string }> = [
  { value: "all", label: "Any source" },
  { value: "google", label: "Google Docs/Sheets/Slides" },
  { value: "ms-office", label: "MS Office" },
  { value: "media", label: "Media files" },
];

function classifyType(mime: string): TypeFilter {
  if (mime === "application/vnd.google-apps.folder") return "folder";
  if (mime === "application/vnd.google-apps.document") return "document";
  if (mime === "application/vnd.google-apps.spreadsheet") return "spreadsheet";
  if (mime === "application/vnd.google-apps.presentation") return "presentation";
  if (mime === "application/pdf") return "pdf";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  if (mime === "application/zip" || mime.includes("compressed") || mime.includes("tar")) return "archive";
  if (mime.includes("wordprocessingml")) return "document";
  if (mime.includes("spreadsheetml")) return "spreadsheet";
  if (mime.includes("presentationml")) return "presentation";
  return "other";
}

function isWithin(iso: string | undefined, ms: number): boolean {
  if (!iso) return false;
  return Date.now() - new Date(iso).getTime() <= ms;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function matchesModified(file: DriveFile, filter: ModifiedFilter): boolean {
  if (filter === "any") return true;
  switch (filter) {
    case "today":      return isWithin(file.modifiedTime, DAY_MS);
    case "this-week":  return isWithin(file.modifiedTime, 7 * DAY_MS);
    case "this-month": return isWithin(file.modifiedTime, 30 * DAY_MS);
    case "this-year":  return isWithin(file.modifiedTime, 365 * DAY_MS);
  }
}

function matchesSource(file: DriveFile, filter: SourceFilter): boolean {
  if (filter === "all") return true;
  const mime = file.mimeType;
  switch (filter) {
    case "google":   return mime.startsWith("application/vnd.google-apps.");
    case "ms-office":return mime.includes("officedocument") || mime.includes("ms-excel") || mime.includes("ms-powerpoint") || mime.includes("msword");
    case "media":    return mime.startsWith("image/") || mime.startsWith("video/") || mime.startsWith("audio/");
  }
}

export function applyFilters(
  files: DriveFile[],
  filters: Filters,
  search: string,
  opts?: {
    currentUserEmail?: string;
    taggedFileIds?: Set<string>;
    hiddenFileIds?: Set<string>;
    showHidden?: boolean;
    hiddenViewOnly?: boolean;
  }
): DriveFile[] {
  const q = search.trim().toLowerCase();
  const tagged = opts?.taggedFileIds;
  const hidden = opts?.hiddenFileIds;
  return files.filter((f) => {
    if (opts?.hiddenViewOnly) {
      if (!hidden?.has(f.id)) return false;
    } else if (hidden?.has(f.id) && !opts?.showHidden) {
      return false;
    }
    if (filters.type !== "all" && classifyType(f.mimeType) !== filters.type) return false;
    if (!matchesModified(f, filters.modified)) return false;
    if (!matchesSource(f, filters.source)) return false;
    if (filters.sharedOnly && !f.shared) return false;
    if (filters.untaggedOnly && tagged?.has(f.id)) return false;
    if (q && !f.name.toLowerCase().includes(q)) return false;
    return true;
  });
}

export function filtersAreActive(filters: Filters, search: string): boolean {
  return search.trim() !== ""
    || filters.type !== "all"
    || filters.modified !== "any"
    || filters.source !== "all"
    || !!filters.sharedOnly
    || !!filters.untaggedOnly;
}