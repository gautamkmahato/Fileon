import {
  type DriveFile,
  FOLDER_MIME,
  isFolder,
  listFilesByQuery,
} from "@/lib/drive/drive";
import { cacheFolderNamesFromFiles } from "@/lib/drive/folder-name-cache";

/** Slim folder record kept in memory for the folder tree. */
export type FolderChildRef = Pick<DriveFile, "id" | "name" | "mimeType" | "parents">;

export interface FolderChildrenCacheEntry {
  folders: FolderChildRef[];
  fetchedAt: number;
}

/** Match files list cache — background refresh after this window. */
export const FOLDER_CHILDREN_STALE_MS = 180_000;

const MAX_PARENT_ENTRIES = 128;
const MAX_SEARCH_ENTRIES = 32;
const SEARCH_STALE_MS = 60_000;

interface SearchCacheEntry {
  results: FolderChildRef[];
  fetchedAt: number;
}

type InvalidationListener = (event: FolderTreeInvalidationEvent) => void;

export interface FolderTreeInvalidationEvent {
  /** Parent cache keys whose child lists changed (`null` = root). */
  invalidateParents?: (string | null)[];
  renamed?: { id: string; name: string }[];
  removedFolderIds?: string[];
}

function escapeQueryValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

export function normalizeParentCacheKey(parentId: string | null | undefined): string {
  if (!parentId || parentId === "root") return "root";
  return parentId;
}

function toFolderRef(file: DriveFile): FolderChildRef {
  return {
    id: file.id,
    name: file.name,
    mimeType: file.mimeType,
    parents: file.parents,
  };
}

function folderQuery(parentId: string | null): string {
  if (parentId === null) {
    return "mimeType = 'application/vnd.google-apps.folder' and trashed = false and 'root' in parents";
  }
  return `mimeType = 'application/vnd.google-apps.folder' and trashed = false and '${parentId}' in parents`;
}

/** LRU-ordered map: oldest key is first in iteration order. */
class LruMap<K, V> {
  private map = new Map<K, V>();

  constructor(private readonly maxSize: number) {}

  get(key: K): V | undefined {
    const value = this.map.get(key);
    if (value === undefined) return undefined;
    this.map.delete(key);
    this.map.set(key, value);
    return value;
  }

  set(key: K, value: V): void {
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, value);
    while (this.map.size > this.maxSize) {
      const oldest = this.map.keys().next().value;
      if (oldest === undefined) break;
      this.map.delete(oldest);
    }
  }

  delete(key: K): boolean {
    return this.map.delete(key);
  }

  clear(): void {
    this.map.clear();
  }

  has(key: K): boolean {
    return this.map.has(key);
  }

  forEach(fn: (value: V) => void): void {
    for (const value of this.map.values()) fn(value);
  }
}

const parentCache = new LruMap<string, FolderChildrenCacheEntry>(MAX_PARENT_ENTRIES);
const searchCache = new LruMap<string, SearchCacheEntry>(MAX_SEARCH_ENTRIES);
const inflight = new Map<string, Promise<FolderChildRef[]>>();
const listeners = new Set<InvalidationListener>();

export function subscribeFolderTreeInvalidation(
  listener: InvalidationListener,
): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notifyInvalidation(event: FolderTreeInvalidationEvent): void {
  for (const listener of listeners) {
    try {
      listener(event);
    } catch (err) {
      console.error(err);
    }
  }
}

export function getFolderChildrenCacheEntry(
  parentId: string | null,
): FolderChildrenCacheEntry | undefined {
  return parentCache.get(normalizeParentCacheKey(parentId));
}

export function isFolderChildrenCacheFresh(fetchedAt: number): boolean {
  return Date.now() - fetchedAt < FOLDER_CHILDREN_STALE_MS;
}

export function setCachedFolderChildren(
  parentId: string | null,
  folders: FolderChildRef[],
): void {
  parentCache.set(normalizeParentCacheKey(parentId), {
    folders,
    fetchedAt: Date.now(),
  });
  cacheFolderNamesFromFiles(folders);
}

async function fetchAllFoldersForParent(
  token: string,
  parentId: string | null,
): Promise<FolderChildRef[]> {
  const all: FolderChildRef[] = [];
  let pageToken: string | undefined;

  do {
    const res = await listFilesByQuery({
      token,
      q: folderQuery(parentId),
      orderBy: "name",
      pageSize: 100,
      pageToken,
    });
    for (const file of res.files) {
      if (isFolder(file)) all.push(toFolderRef(file));
    }
    pageToken = res.nextPageToken;
  } while (pageToken);

  return all;
}

async function fetchAndCache(
  token: string,
  parentId: string | null,
): Promise<FolderChildRef[]> {
  const key = normalizeParentCacheKey(parentId);
  const promise = fetchAllFoldersForParent(token, parentId).then((folders) => {
    setCachedFolderChildren(parentId, folders);
    return folders;
  });
  inflight.set(key, promise);
  try {
    return await promise;
  } finally {
    inflight.delete(key);
  }
}

/**
 * Return cached folder children immediately when available.
 * Refreshes stale entries in the background; dedupes concurrent fetches.
 */
export async function loadFolderChildren(
  token: string,
  parentId: string | null,
  opts?: { force?: boolean },
): Promise<{ folders: FolderChildRef[]; fromCache: boolean }> {
  const key = normalizeParentCacheKey(parentId);
  const cached = parentCache.get(key);

  if (cached && !opts?.force) {
    if (!isFolderChildrenCacheFresh(cached.fetchedAt)) {
      if (!inflight.has(key)) {
        void fetchAndCache(token, parentId).catch(console.error);
      }
    }
    return { folders: cached.folders, fromCache: true };
  }

  if (inflight.has(key)) {
    const folders = await inflight.get(key)!;
    return { folders, fromCache: Boolean(cached) };
  }

  const folders = await fetchAndCache(token, parentId);
  return { folders, fromCache: false };
}

export function hasFolderChildrenCache(parentId: string | null): boolean {
  return parentCache.has(normalizeParentCacheKey(parentId));
}

export function patchFolderNameInCache(folderId: string, name: string): void {
  parentCache.forEach((entry) => {
    const idx = entry.folders.findIndex((f) => f.id === folderId);
    if (idx >= 0) {
      entry.folders[idx] = { ...entry.folders[idx], name };
    }
  });
  searchCache.forEach((entry) => {
    const idx = entry.results.findIndex((f) => f.id === folderId);
    if (idx >= 0) {
      entry.results[idx] = { ...entry.results[idx], name };
    }
  });
}

export function invalidateFolderChildrenCache(parentId?: string | null): void {
  if (parentId === undefined) {
    parentCache.clear();
    searchCache.clear();
    inflight.clear();
    return;
  }
  const key = normalizeParentCacheKey(parentId);
  parentCache.delete(key);
  inflight.delete(key);
}

export function invalidateFolderTreeForMutation(event: FolderTreeInvalidationEvent): void {
  searchCache.clear();

  if (event.removedFolderIds?.length) {
    for (const id of event.removedFolderIds) {
      parentCache.delete(id);
      inflight.delete(id);
    }
  }

  if (event.invalidateParents?.length) {
    const seen = new Set<string>();
    for (const parentId of event.invalidateParents) {
      const key = normalizeParentCacheKey(parentId);
      if (seen.has(key)) continue;
      seen.add(key);
      parentCache.delete(key);
      inflight.delete(key);
    }
  }

  if (event.renamed?.length) {
    for (const { id, name } of event.renamed) {
      patchFolderNameInCache(id, name);
    }
  }

  notifyInvalidation(event);
}

export async function searchFoldersCached(
  token: string,
  query: string,
): Promise<FolderChildRef[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const cacheKey = trimmed.toLowerCase();
  const cached = searchCache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < SEARCH_STALE_MS) {
    return cached.results;
  }

  const q = escapeQueryValue(trimmed);
  const all: FolderChildRef[] = [];
  let pageToken: string | undefined;

  do {
    const res = await listFilesByQuery({
      token,
      q: `mimeType = '${FOLDER_MIME}' and trashed = false and name contains '${q}'`,
      orderBy: "name",
      pageSize: 200,
      pageToken,
    });
    for (const file of res.files) {
      if (isFolder(file)) all.push(toFolderRef(file));
    }
    pageToken = res.nextPageToken;
  } while (pageToken);

  searchCache.set(cacheKey, { results: all, fetchedAt: Date.now() });
  cacheFolderNamesFromFiles(all);
  return all;
}

export function clearFolderChildrenCache(): void {
  invalidateFolderChildrenCache();
}
