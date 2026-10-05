/**
 * Central eviction on sign-out and global invalidation after mutations.
 */
import {
  clearDriveMemoryCaches,
  invalidateDriveFile,
  invalidateDriveListQueries,
} from "./drive-memory";
import { clearFolderChildrenCache } from "./folder-children-cache";
import { clearFolderItemCountCache } from "./folder-item-count-cache";
import { clearTypeBrowseCountsCache } from "./type-browse-counts-cache";
import { invalidateTagFileIdsCache } from "@/lib/tags/file-ids-cache";
import { clearFolderNameCache } from "@/lib/drive/folder-name-cache";
import { invalidateFilesCache } from "@/lib/stores/files-cache";

/** Drop all in-app caches (memory + existing module caches). Safe on sign-out. */
export function clearAllSessionCaches(): void {
  clearDriveMemoryCaches();
  clearFolderChildrenCache();
  clearFolderItemCountCache();
  clearTypeBrowseCountsCache();
  invalidateTagFileIdsCache();
  clearFolderNameCache();
  invalidateFilesCache();
}

/** After a file changes remotely — keep lists snappy without stale metadata. */
export function invalidateCachesForFileMutation(fileId: string): void {
  invalidateDriveFile(fileId);
  invalidateDriveListQueries();
  clearFolderItemCountCache();
}
