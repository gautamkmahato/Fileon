import { listFiles } from "@/lib/drive/drive";
import { folderItemCountCache } from "@/lib/cache/drive-memory";
import { InflightDeduper } from "./memory-cache";

export interface FolderItemCount {
  count: number;
  hasMore: boolean;
}

const inflight = new InflightDeduper<FolderItemCount>();

export function getCachedFolderItemCount(folderId: string): FolderItemCount | undefined {
  return folderItemCountCache.get(folderId);
}

export async function loadFolderItemCount(
  token: string,
  folderId: string,
  opts?: { force?: boolean },
): Promise<FolderItemCount> {
  const cached = folderItemCountCache.get(folderId);
  if (cached && !opts?.force) {
    return cached;
  }

  return inflight.run(folderId, async () => {
    const again = folderItemCountCache.get(folderId);
    if (again && !opts?.force) return again;

    try {
      const res = await listFiles({ token, folderId, pageSize: 100 });
      const value: FolderItemCount = { count: res.files.length, hasMore: !!res.nextPageToken };
      folderItemCountCache.set(folderId, value);
      return value;
    } catch {
      return cached ?? { count: 0, hasMore: false };
    }
  });
}

export function clearFolderItemCountCache(): void {
  folderItemCountCache.clear();
  inflight.clear();
}

export function formatFolderItemCount(count?: FolderItemCount): string | null {
  if (!count) return null;
  const n = count.hasMore ? `${count.count}+` : count.count.toLocaleString();
  const label = count.count === 1 && !count.hasMore ? "item" : "items";
  return `${n} ${label}`;
}
