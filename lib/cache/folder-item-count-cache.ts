import { listFiles } from "@/lib/drive/drive";

export interface FolderItemCount {
  count: number;
  hasMore: boolean;
}

interface FolderItemCountEntry extends FolderItemCount {
  fetchedAt: number;
}

export const FOLDER_ITEM_COUNT_STALE_MS = 180_000;

const cache = new Map<string, FolderItemCountEntry>();
const inflight = new Map<string, Promise<FolderItemCount>>();

export function getCachedFolderItemCount(folderId: string): FolderItemCount | undefined {
  const entry = cache.get(folderId);
  if (!entry) return undefined;
  return { count: entry.count, hasMore: entry.hasMore };
}

export async function loadFolderItemCount(
  token: string,
  folderId: string,
  opts?: { force?: boolean },
): Promise<FolderItemCount> {
  const cached = cache.get(folderId);
  if (cached && !opts?.force && Date.now() - cached.fetchedAt < FOLDER_ITEM_COUNT_STALE_MS) {
    return { count: cached.count, hasMore: cached.hasMore };
  }

  if (inflight.has(folderId)) {
    return inflight.get(folderId)!;
  }

  const promise = listFiles({ token, folderId, pageSize: 100 })
    .then((res) => {
      const value = { count: res.files.length, hasMore: !!res.nextPageToken };
      cache.set(folderId, { ...value, fetchedAt: Date.now() });
      return value;
    })
    .catch(() => cached ?? { count: 0, hasMore: false })
    .finally(() => {
      inflight.delete(folderId);
    });

  inflight.set(folderId, promise);
  return promise;
}

export function invalidateFolderItemCount(folderId: string): void {
  cache.delete(folderId);
  inflight.delete(folderId);
}

export function clearFolderItemCountCache(): void {
  cache.clear();
  inflight.clear();
}

export function formatFolderItemCount(count?: FolderItemCount): string | null {
  if (!count) return null;
  const n = count.hasMore ? `${count.count}+` : count.count.toLocaleString();
  const label = count.count === 1 && !count.hasMore ? "item" : "items";
  return `${n} ${label}`;
}
