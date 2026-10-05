import { tagFileIdsCache } from "@/lib/cache/drive-memory";

export function getTagFileIdsCache(key: string): string[] | undefined {
  return tagFileIdsCache.get(key);
}

export function setTagFileIdsCache(key: string, ids: string[]): void {
  tagFileIdsCache.set(key, ids);
}

export function invalidateTagFileIdsCache(): void {
  tagFileIdsCache.clear();
}
