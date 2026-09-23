import type { DriveFile } from "@/lib/drive/drive";
import { getFileType } from "@/lib/types/file-types";

export type SortField = "name" | "modified" | "size" | "type";
export type SortDir = "asc" | "desc";

export interface SortState {
  field: SortField;
  dir: SortDir;
}

export const DEFAULT_FOLDER_SORT: SortState = { field: "name", dir: "asc" };
export const DEFAULT_FILE_SORT: SortState = { field: "modified", dir: "desc" };
export const DEFAULT_TRASH_SORT: SortState = { field: "modified", dir: "desc" };

const STORAGE_KEY = "drive_file_sort";

export function loadFileSort(): SortState {
  if (typeof window === "undefined") return DEFAULT_FILE_SORT;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_FILE_SORT;
    const parsed = JSON.parse(raw) as SortState;
    if (parsed.field && parsed.dir) return parsed;
  } catch { /* ignore */ }
  return DEFAULT_FILE_SORT;
}

export function saveFileSort(sort: SortState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sort));
}

function cmpStr(a: string, b: string, dir: SortDir): number {
  const r = a.localeCompare(b, undefined, { sensitivity: "base" });
  return dir === "asc" ? r : -r;
}

function cmpNum(a: number, b: number, dir: SortDir): number {
  const r = a - b;
  return dir === "asc" ? r : -r;
}

export function sortDriveFiles(files: DriveFile[], sort: SortState): DriveFile[] {
  const sorted = [...files];
  sorted.sort((a, b) => {
    switch (sort.field) {
      case "name":
        return cmpStr(a.name, b.name, sort.dir);
      case "modified": {
        const ta = a.modifiedTime ? new Date(a.modifiedTime).getTime() : 0;
        const tb = b.modifiedTime ? new Date(b.modifiedTime).getTime() : 0;
        return cmpNum(ta, tb, sort.dir);
      }
      case "size": {
        const sa = a.size ? parseInt(a.size, 10) : 0;
        const sb = b.size ? parseInt(b.size, 10) : 0;
        return cmpNum(sa, sb, sort.dir);
      }
      case "type": {
        const la = getFileType(a.mimeType).label;
        const lb = getFileType(b.mimeType).label;
        const typeCmp = cmpStr(la, lb, sort.dir);
        return typeCmp !== 0 ? typeCmp : cmpStr(a.name, b.name, "asc");
      }
      default:
        return 0;
    }
  });
  return sorted;
}

export const SORT_OPTIONS: Array<{ value: string; label: string; state: SortState }> = [
  { value: "modified-desc", label: "Modified (newest)", state: { field: "modified", dir: "desc" } },
  { value: "modified-asc", label: "Modified (oldest)", state: { field: "modified", dir: "asc" } },
  { value: "name-asc", label: "Name (A–Z)", state: { field: "name", dir: "asc" } },
  { value: "name-desc", label: "Name (Z–A)", state: { field: "name", dir: "desc" } },
  { value: "size-desc", label: "Size (largest)", state: { field: "size", dir: "desc" } },
  { value: "size-asc", label: "Size (smallest)", state: { field: "size", dir: "asc" } },
  { value: "type-asc", label: "Type (A–Z)", state: { field: "type", dir: "asc" } },
];

export function sortStateKey(s: SortState): string {
  return `${s.field}-${s.dir}`;
}

export function sortLabel(s: SortState): string {
  return SORT_OPTIONS.find((o) => sortStateKey(o.state) === sortStateKey(s))?.label ?? "Modified";
}
