import { openLocalDb, STORE_HIDDEN, withStore } from "./local-db";

export interface HiddenRecord {
  fileId: string;
  hiddenAt: number;
}

type HiddenListener = () => void;
const listeners = new Set<HiddenListener>();

function notify() {
  listeners.forEach((fn) => fn());
}

export function subscribeHidden(fn: HiddenListener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export async function listHiddenRecords(): Promise<HiddenRecord[]> {
  if (typeof window === "undefined") return [];
  return withStore(STORE_HIDDEN, "readonly", (s) => s.getAll()) as Promise<HiddenRecord[]>;
}

export async function listHiddenFileIds(): Promise<string[]> {
  const rows = await listHiddenRecords();
  return rows.map((r) => r.fileId);
}

export async function hideFile(fileId: string): Promise<HiddenRecord> {
  const record: HiddenRecord = { fileId, hiddenAt: Date.now() };
  await withStore(STORE_HIDDEN, "readwrite", (s) => s.put(record));
  notify();
  return record;
}

export async function unhideFile(fileId: string): Promise<void> {
  await withStore(STORE_HIDDEN, "readwrite", (s) => s.delete(fileId));
  notify();
}

export async function toggleHidden(fileId: string): Promise<boolean> {
  const existing = await withStore(STORE_HIDDEN, "readonly", (s) => s.get(fileId)) as HiddenRecord | undefined;
  if (existing) {
    await unhideFile(fileId);
    return false;
  }
  await hideFile(fileId);
  return true;
}

export async function removeHiddenForFile(fileId: string): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    await withStore(STORE_HIDDEN, "readwrite", (s) => s.delete(fileId));
    notify();
  } catch {
    /* ignore missing */
  }
}

export async function hideFiles(fileIds: string[]): Promise<void> {
  if (!fileIds.length) return;
  const db = await openLocalDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_HIDDEN, "readwrite");
    const store = tx.objectStore(STORE_HIDDEN);
    const now = Date.now();
    for (const fileId of fileIds) {
      store.put({ fileId, hiddenAt: now });
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  notify();
}

export async function unhideFiles(fileIds: string[]): Promise<void> {
  if (!fileIds.length) return;
  const db = await openLocalDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_HIDDEN, "readwrite");
    const store = tx.objectStore(STORE_HIDDEN);
    for (const fileId of fileIds) {
      store.delete(fileId);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  notify();
}
