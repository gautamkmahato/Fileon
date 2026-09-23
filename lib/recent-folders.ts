import { isFolder, type DriveFile } from "./drive/drive";

const STORAGE_KEY = "gdrive-recent-folders";
const MAX = 3;

type RecentFoldersListener = () => void;
const listeners = new Set<RecentFoldersListener>();

function notifyRecentFolders() {
  listeners.forEach((fn) => fn());
}

export function subscribeRecentFolders(fn: RecentFoldersListener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function listRecentFolderIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export function recordRecentFolder(folderId: string): void {
  if (typeof window === "undefined" || !folderId) return;
  const prev = listRecentFolderIds().filter((id) => id !== folderId);
  const next = [folderId, ...prev].slice(0, MAX);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    notifyRecentFolders();
  } catch {
    // ignore quota errors
  }
}

/** Record folder(s) where work was done — not for passive navigation. */
export function recordRecentFolderWork(opts: {
  locationFolderId?: string | null;
  items?: DriveFile[];
  destinationFolderId?: string | null;
} = {}): void {
  const ids = new Set<string>();
  const add = (id: string | null | undefined) => {
    if (id && id !== "root") ids.add(id);
  };

  add(opts.locationFolderId);
  add(opts.destinationFolderId);

  for (const item of opts.items ?? []) {
    if (isFolder(item)) add(item.id);
    add(item.parents?.[0]);
  }

  for (const id of ids) recordRecentFolder(id);
}
