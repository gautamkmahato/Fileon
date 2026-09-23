import { fetchAllFilesByIds, isFolder } from "./drive/drive";
import { withStore, STORE_FOLDER_FAVORITES } from "./local-db";
import { DASHBOARD_PINS_KEY, listPinsForFolder, unpinItem } from "./pins";

export interface FavoriteRecord {
  folderId: string;
  favoritedAt: number;
  order: number;
}

type FavoritesListener = () => void;
const listeners = new Set<FavoritesListener>();

function notify() {
  listeners.forEach((fn) => fn());
}

export function subscribeFavorites(fn: FavoritesListener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export async function listFavoriteRecords(): Promise<FavoriteRecord[]> {
  if (typeof window === "undefined") return [];
  const rows = await withStore(STORE_FOLDER_FAVORITES, "readonly", (s) => s.getAll()) as FavoriteRecord[];
  return rows.sort((a, b) => a.order - b.order);
}

export async function listFavoriteFolderIds(): Promise<string[]> {
  const rows = await listFavoriteRecords();
  return rows.map((r) => r.folderId);
}

export async function isFavoriteFolder(folderId: string): Promise<boolean> {
  const row = await withStore(STORE_FOLDER_FAVORITES, "readonly", (s) => s.get(folderId)) as FavoriteRecord | undefined;
  return !!row;
}

export async function favoriteFolder(folderId: string): Promise<FavoriteRecord> {
  const existing = await withStore(STORE_FOLDER_FAVORITES, "readonly", (s) => s.get(folderId)) as FavoriteRecord | undefined;
  if (existing) return existing;

  const all = await listFavoriteRecords();
  const record: FavoriteRecord = {
    folderId,
    favoritedAt: Date.now(),
    order: all.length > 0 ? Math.max(...all.map((r) => r.order)) + 1 : 0,
  };
  await withStore(STORE_FOLDER_FAVORITES, "readwrite", (s) => s.put(record));
  notify();
  return record;
}

export async function unfavoriteFolder(folderId: string): Promise<void> {
  await withStore(STORE_FOLDER_FAVORITES, "readwrite", (s) => s.delete(folderId));
  notify();
}

export async function toggleFavoriteFolder(folderId: string): Promise<boolean> {
  const favorited = await isFavoriteFolder(folderId);
  if (favorited) {
    await unfavoriteFolder(folderId);
    return false;
  }
  await favoriteFolder(folderId);
  return true;
}

export async function removeFavoriteForFolder(folderId: string): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    await withStore(STORE_FOLDER_FAVORITES, "readwrite", (s) => s.delete(folderId));
    notify();
  } catch {
    /* ignore */
  }
}

/** Move legacy dashboard folder pins into favorites (folders only). */
export async function migrateFolderPinsToFavorites(token: string): Promise<void> {
  const pins = await listPinsForFolder(DASHBOARD_PINS_KEY);
  if (!pins.length) return;

  const files = await fetchAllFilesByIds(token, pins.map((p) => p.fileId));
  for (const file of files) {
    if (!isFolder(file)) continue;
    await favoriteFolder(file.id);
    await unpinItem(DASHBOARD_PINS_KEY, file.id);
  }
}
