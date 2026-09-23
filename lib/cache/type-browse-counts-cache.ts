import {
  listFilesByType,
  TYPE_BROWSE_CATEGORIES,
  type TypeBrowseCategory,
} from "@/lib/drive/type-browse";

export interface TypeBrowseCount {
  count: number;
  hasMore: boolean;
}

interface TypeBrowseCountEntry extends TypeBrowseCount {
  fetchedAt: number;
}

/** Match other in-memory list caches. */
export const TYPE_BROWSE_COUNTS_STALE_MS = 180_000;

const cache = new Map<TypeBrowseCategory, TypeBrowseCountEntry>();
const listeners = new Set<() => void>();
let batchInflight: Promise<Partial<Record<TypeBrowseCategory, TypeBrowseCount>>> | null = null;

/** Stable empty snapshot for useSyncExternalStore / signed-out state. */
export const EMPTY_TYPE_BROWSE_COUNTS: Partial<Record<TypeBrowseCategory, TypeBrowseCount>> = {};

/** Stable snapshot reference — only replaced when count values change. */
let snapshot: Partial<Record<TypeBrowseCategory, TypeBrowseCount>> = EMPTY_TYPE_BROWSE_COUNTS;

function snapshotsEqual(
  a: Partial<Record<TypeBrowseCategory, TypeBrowseCount>>,
  b: Partial<Record<TypeBrowseCategory, TypeBrowseCount>>,
): boolean {
  for (const category of TYPE_BROWSE_CATEGORIES) {
    const av = a[category];
    const bv = b[category];
    if (!av && !bv) continue;
    if (!av || !bv || av.count !== bv.count || av.hasMore !== bv.hasMore) return false;
  }
  return true;
}

function refreshSnapshot(): void {
  const next: Partial<Record<TypeBrowseCategory, TypeBrowseCount>> = {};
  let hasAny = false;
  for (const category of TYPE_BROWSE_CATEGORIES) {
    const entry = cache.get(category);
    if (entry) {
      next[category] = { count: entry.count, hasMore: entry.hasMore };
      hasAny = true;
    }
  }
  if (!hasAny) {
    snapshot = EMPTY_TYPE_BROWSE_COUNTS;
    return;
  }
  if (snapshotsEqual(snapshot, next)) return;
  snapshot = next;
}

function notifyListeners(): void {
  refreshSnapshot();
  for (const listener of listeners) {
    try {
      listener();
    } catch (err) {
      console.error(err);
    }
  }
}

export function subscribeTypeBrowseCounts(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getCachedTypeBrowseCounts(): Partial<Record<TypeBrowseCategory, TypeBrowseCount>> {
  return snapshot;
}

export function isTypeBrowseCountsCacheFresh(fetchedAt: number): boolean {
  return Date.now() - fetchedAt < TYPE_BROWSE_COUNTS_STALE_MS;
}

function isCategoryFresh(category: TypeBrowseCategory): boolean {
  const entry = cache.get(category);
  return !!entry && isTypeBrowseCountsCacheFresh(entry.fetchedAt);
}

function allCategoriesFresh(): boolean {
  return TYPE_BROWSE_CATEGORIES.every(isCategoryFresh);
}

async function fetchAllTypeBrowseCounts(
  token: string,
): Promise<Partial<Record<TypeBrowseCategory, TypeBrowseCount>>> {
  const rows = await Promise.all(
    TYPE_BROWSE_CATEGORIES.map(async (category) => {
      try {
        const res = await listFilesByType(token, category);
        return {
          category,
          count: res.files.length,
          hasMore: !!res.nextPageToken,
        };
      } catch {
        return null;
      }
    }),
  );

  const now = Date.now();
  for (const row of rows) {
    if (!row) continue;
    cache.set(row.category, {
      count: row.count,
      hasMore: row.hasMore,
      fetchedAt: now,
    });
  }

  notifyListeners();
  return getCachedTypeBrowseCounts();
}

/**
 * Return cached counts immediately when available.
 * Refreshes stale or missing entries in the background; dedupes concurrent batch fetches.
 */
export async function loadTypeBrowseCounts(
  token: string,
  opts?: { force?: boolean },
): Promise<Partial<Record<TypeBrowseCategory, TypeBrowseCount>>> {
  const snapshot = getCachedTypeBrowseCounts();
  const hasCache = TYPE_BROWSE_CATEGORIES.some((cat) => cache.has(cat));

  if (!opts?.force && allCategoriesFresh()) {
    return snapshot;
  }

  if (hasCache && !opts?.force) {
    if (!batchInflight) {
      void fetchAllTypeBrowseCounts(token).catch(console.error);
    }
    return snapshot;
  }

  if (batchInflight) {
    return batchInflight;
  }

  const promise = fetchAllTypeBrowseCounts(token);
  batchInflight = promise;
  try {
    return await promise;
  } finally {
    batchInflight = null;
  }
}

/** Mark counts stale and optionally refresh in the background. Keeps last-known values visible. */
export function invalidateTypeBrowseCountsCache(opts?: { refreshToken?: string | null }): void {
  for (const category of TYPE_BROWSE_CATEGORIES) {
    const entry = cache.get(category);
    if (entry) {
      cache.set(category, { ...entry, fetchedAt: 0 });
    }
  }
  batchInflight = null;
  notifyListeners();
  if (opts?.refreshToken) {
    void loadTypeBrowseCounts(opts.refreshToken, { force: true }).catch(console.error);
  }
}

export function clearTypeBrowseCountsCache(): void {
  cache.clear();
  batchInflight = null;
  snapshot = EMPTY_TYPE_BROWSE_COUNTS;
  notifyListeners();
}
