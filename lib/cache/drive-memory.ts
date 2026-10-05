import type { DriveFile, DriveListResponse, UserProfile } from "@/lib/drive/drive";
import { MemoryCache, InflightDeduper, registerMemoryCache } from "./memory-cache";

/** Per-file metadata from files.get */
export const driveFileCache = new MemoryCache<DriveFile>({
  name: "drive:file",
  maxEntries: 2_500,
  defaultTtlMs: 5 * 60_000,
});

/** First page of list/search queries (keyed without access token). */
export const driveListQueryCache = new MemoryCache<DriveListResponse>({
  name: "drive:list-query",
  maxEntries: 96,
  defaultTtlMs: 3 * 60_000,
});

export const driveSearchCache = new MemoryCache<DriveListResponse>({
  name: "drive:search",
  maxEntries: 48,
  defaultTtlMs: 90_000,
});

export const userProfileCache = new MemoryCache<UserProfile>({
  name: "auth:profile",
  maxEntries: 4,
  defaultTtlMs: 30 * 60_000,
});

export const storageQuotaCache = new MemoryCache<{
  limit?: string;
  usage?: string;
  usageInDrive?: string;
}>({
  name: "drive:quota",
  maxEntries: 2,
  defaultTtlMs: 5 * 60_000,
});

export const folderNameCache = new MemoryCache<string>({
  name: "drive:folder-name",
  maxEntries: 4_000,
  defaultTtlMs: 24 * 60 * 60_000,
});

export const tagFileIdsCache = new MemoryCache<string[]>({
  name: "tags:file-ids",
  maxEntries: 128,
  defaultTtlMs: 2 * 60_000,
});

export const folderItemCountCache = new MemoryCache<{
  count: number;
  hasMore: boolean;
}>({
  name: "drive:folder-item-count",
  maxEntries: 256,
  defaultTtlMs: 3 * 60_000,
});

export const fileInflight = new InflightDeduper<DriveFile>();
export const listInflight = new InflightDeduper<DriveListResponse>();

for (const cache of [
  driveFileCache,
  driveListQueryCache,
  driveSearchCache,
  userProfileCache,
  storageQuotaCache,
  folderNameCache,
  tagFileIdsCache,
  folderItemCountCache,
]) {
  registerMemoryCache(cache);
}

export function cacheDriveFile(file: DriveFile): void {
  if (!file?.id) return;
  driveFileCache.set(file.id, file);
  if (file.mimeType === "application/vnd.google-apps.folder" && file.name) {
    folderNameCache.set(file.id, file.name);
  }
}

export function cacheDriveFiles(files: DriveFile[]): void {
  for (const f of files) cacheDriveFile(f);
}

export function invalidateDriveFile(fileId: string): void {
  if (!fileId) return;
  driveFileCache.delete(fileId);
}

export function invalidateDriveListQueries(): void {
  driveListQueryCache.clear();
  driveSearchCache.clear();
  folderItemCountCache.clear();
  listInflight.clear();
}

export function patchDriveFileInCache(updated: DriveFile): void {
  cacheDriveFile(updated);
}

export function clearDriveMemoryCaches(): void {
  driveFileCache.clear();
  driveListQueryCache.clear();
  driveSearchCache.clear();
  userProfileCache.clear();
  storageQuotaCache.clear();
  folderNameCache.clear();
  tagFileIdsCache.clear();
  folderItemCountCache.clear();
  fileInflight.clear();
  listInflight.clear();
}

export function stableQueryKey(parts: Record<string, string | number | boolean | undefined | null>): string {
  return Object.keys(parts)
    .sort()
    .map((k) => `${k}=${parts[k] ?? ""}`)
    .join("&");
}
