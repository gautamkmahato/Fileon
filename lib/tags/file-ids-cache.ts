const cache = new Map<string, { ids: string[]; fetchedAt: number }>();
const TTL_MS = 120_000;

export function getTagFileIdsCache(key: string): string[] | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (Date.now() - entry.fetchedAt > TTL_MS) {
    cache.delete(key);
    return undefined;
  }
  return entry.ids;
}

export function setTagFileIdsCache(key: string, ids: string[]): void {
  cache.set(key, { ids, fetchedAt: Date.now() });
}

export function invalidateTagFileIdsCache(): void {
  cache.clear();
}
