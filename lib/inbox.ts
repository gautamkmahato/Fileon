import { openLocalDb, STORE_INBOX, withStore } from "./local-db";

export interface InboxRecord {
  fileId: string;
  addedAt: number;
}

type InboxListener = () => void;
const listeners = new Set<InboxListener>();

function notify() {
  listeners.forEach((fn) => fn());
}

function uniqueIds(fileIds: string[]): string[] {
  return [...new Set(fileIds.filter((id) => typeof id === "string" && id.trim().length > 0))];
}

export function subscribeInbox(fn: InboxListener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export async function listInboxRecords(): Promise<InboxRecord[]> {
  if (typeof window === "undefined") return [];
  try {
    const rows = await withStore(STORE_INBOX, "readonly", (s) => s.getAll()) as InboxRecord[];
    return rows
      .filter((r) => r?.fileId)
      .sort((a, b) => (b.addedAt ?? 0) - (a.addedAt ?? 0));
  } catch {
    return [];
  }
}

export async function listInboxFileIds(): Promise<string[]> {
  const rows = await listInboxRecords();
  return rows.map((r) => r.fileId);
}

export async function isInInbox(fileId: string): Promise<boolean> {
  if (!fileId || typeof window === "undefined") return false;
  try {
    const row = await withStore(STORE_INBOX, "readonly", (s) => s.get(fileId)) as InboxRecord | undefined;
    return !!row;
  } catch {
    return false;
  }
}

export async function addToInbox(fileIds: string[]): Promise<void> {
  const ids = uniqueIds(fileIds);
  if (!ids.length || typeof window === "undefined") return;
  const db = await openLocalDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_INBOX, "readwrite");
    const store = tx.objectStore(STORE_INBOX);
    const now = Date.now();
    for (const fileId of ids) {
      store.put({ fileId, addedAt: now } satisfies InboxRecord);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  notify();
}

export async function removeFromInbox(fileIds: string[]): Promise<void> {
  const ids = uniqueIds(fileIds);
  if (!ids.length || typeof window === "undefined") return;
  try {
    const db = await openLocalDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_INBOX, "readwrite");
      const store = tx.objectStore(STORE_INBOX);
      for (const fileId of ids) store.delete(fileId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    notify();
  } catch {
    /* ignore missing store / records */
  }
}

export async function removeInboxForFile(fileId: string): Promise<void> {
  if (!fileId) return;
  await removeFromInbox([fileId]);
}
