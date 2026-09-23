import { openLocalDb, STORE_FOLDER_COVERS, withStore } from "./local-db";

export type CoverPosition = "center" | "top";

export interface FolderCoverRecord {
  folderId: string;
  coverFileId: string;
  position: CoverPosition;
  updatedAt: number;
}

type FolderCoversListener = () => void;
const listeners = new Set<FolderCoversListener>();

function notify() {
  listeners.forEach((fn) => fn());
}

export function subscribeFolderCovers(fn: FolderCoversListener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export async function listFolderCovers(): Promise<FolderCoverRecord[]> {
  if (typeof window === "undefined") return [];
  return withStore(STORE_FOLDER_COVERS, "readonly", (s) => s.getAll()) as Promise<FolderCoverRecord[]>;
}

export async function getFolderCover(folderId: string): Promise<FolderCoverRecord | null> {
  if (typeof window === "undefined") return null;
  const row = await withStore(STORE_FOLDER_COVERS, "readonly", (s) => s.get(folderId));
  return (row as FolderCoverRecord | undefined) ?? null;
}

export async function setFolderCover(
  folderId: string,
  coverFileId: string,
  position: CoverPosition = "center",
): Promise<FolderCoverRecord> {
  const record: FolderCoverRecord = {
    folderId,
    coverFileId,
    position,
    updatedAt: Date.now(),
  };
  await withStore(STORE_FOLDER_COVERS, "readwrite", (s) => s.put(record));
  notify();
  return record;
}

export async function removeFolderCover(folderId: string): Promise<void> {
  await withStore(STORE_FOLDER_COVERS, "readwrite", (s) => s.delete(folderId));
  notify();
}

export async function removeCoversForFile(fileId: string): Promise<void> {
  if (typeof window === "undefined") return;
  const all = await listFolderCovers();
  const affected = all.filter((r) => r.coverFileId === fileId);
  if (!affected.length) return;
  const db = await openLocalDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_FOLDER_COVERS, "readwrite");
    const store = tx.objectStore(STORE_FOLDER_COVERS);
    for (const row of affected) store.delete(row.folderId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  notify();
}
