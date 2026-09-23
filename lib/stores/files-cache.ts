import type { DriveFile } from "@/lib/drive/drive";

export interface FilesCacheEntry {
  files: DriveFile[];
  nextPageToken?: string;
  fetchedAt: number;
}

/** How long cached lists stay fresh without a background refetch. */
export const FILES_CACHE_STALE_MS = 180_000;

const cache = new Map<string, FilesCacheEntry>();

export function getFilesCache(key: string): FilesCacheEntry | undefined {
  return cache.get(key);
}

export function setFilesCache(
  key: string,
  data: { files: DriveFile[]; nextPageToken?: string }
): void {
  cache.set(key, { ...data, fetchedAt: Date.now() });
}

export function isFilesCacheFresh(entry: FilesCacheEntry): boolean {
  return Date.now() - entry.fetchedAt < FILES_CACHE_STALE_MS;
}

export function invalidateFilesCache(key?: string): void {
  if (key) cache.delete(key);
  else cache.clear();
}
