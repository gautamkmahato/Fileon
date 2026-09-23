import type { DriveFile } from "@/lib/drive/drive";

export const RECENT_FILES_DAYS = 30;

export function isRecentFile(file: DriveFile, days = RECENT_FILES_DAYS): boolean {
  if (!file.modifiedTime) return true;
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return new Date(file.modifiedTime).getTime() >= cutoff;
}

export function filterRecentFiles(files: DriveFile[], days = RECENT_FILES_DAYS): DriveFile[] {
  return files.filter((f) => isRecentFile(f, days));
}
