import { openLocalDb, STORE_PINS, withStore } from "./local-db";

export interface PinRecord {
  key: string;
  folderId: string;
  fileId: string;
  pinnedAt: number;
  order: number;
}

type PinsListener = () => void;
const listeners = new Set<PinsListener>();

function notify() {
  listeners.forEach((fn) => fn());
}

export function subscribePins(fn: PinsListener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Global pin scope — pinned items appear on Dashboard only. */
export const DASHBOARD_PINS_KEY = "dashboard";

/** @deprecated Per-folder pins; use {@link DASHBOARD_PINS_KEY} for new pins. */
export function pinFolderKey(folderId: string | null): string {
  return folderId ?? "root";
}

export function pinRecordKey(folderId: string, fileId: string): string {
  return `${folderId}:${fileId}`;
}

export async function listAllPins(): Promise<PinRecord[]> {
  if (typeof window === "undefined") return [];
  return withStore(STORE_PINS, "readonly", (s) => s.getAll()) as Promise<PinRecord[]>;
}

export async function listPinsForFolder(folderId: string): Promise<PinRecord[]> {
  if (typeof window === "undefined") return [];
  const db = await openLocalDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PINS, "readonly");
    const store = tx.objectStore(STORE_PINS);
    const idx = store.index("folderId");
    const req = idx.getAll(folderId);
    req.onsuccess = () => {
      const rows = (req.result as PinRecord[]).sort((a, b) => a.order - b.order);
      resolve(rows);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function pinItem(folderId: string, fileId: string): Promise<PinRecord> {
  const existing = await listPinsForFolder(folderId);
  const already = existing.find((p) => p.fileId === fileId);
  if (already) return already;

  const record: PinRecord = {
    key: pinRecordKey(folderId, fileId),
    folderId,
    fileId,
    pinnedAt: Date.now(),
    order: existing.length > 0 ? Math.max(...existing.map((p) => p.order)) + 1 : 0,
  };
  await withStore(STORE_PINS, "readwrite", (s) => s.put(record));
  notify();
  return record;
}

export async function unpinItem(folderId: string, fileId: string): Promise<void> {
  const key = pinRecordKey(folderId, fileId);
  await withStore(STORE_PINS, "readwrite", (s) => s.delete(key));
  const remaining = (await listPinsForFolder(folderId)).filter((p) => p.fileId !== fileId);
  await normalizePinOrder(folderId, remaining.map((p) => p.fileId));
  notify();
}

export async function reorderPins(folderId: string, orderedFileIds: string[]): Promise<void> {
  const db = await openLocalDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_PINS, "readwrite");
    const store = tx.objectStore(STORE_PINS);
    orderedFileIds.forEach((fileId, order) => {
      const key = pinRecordKey(folderId, fileId);
      const getReq = store.get(key);
      getReq.onsuccess = () => {
        const row = getReq.result as PinRecord | undefined;
        if (row) store.put({ ...row, order });
      };
    });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  notify();
}

async function normalizePinOrder(folderId: string, orderedFileIds: string[]): Promise<void> {
  if (!orderedFileIds.length) return;
  await reorderPins(folderId, orderedFileIds);
}

export async function removeAllPinsForFile(fileId: string): Promise<void> {
  if (typeof window === "undefined") return;
  const db = await openLocalDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_PINS, "readwrite");
    const store = tx.objectStore(STORE_PINS);
    const idx = store.index("fileId");
    const req = idx.getAll(fileId);
    req.onsuccess = () => {
      for (const row of req.result as PinRecord[]) {
        store.delete(row.key);
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  notify();
}

export async function togglePin(folderId: string, fileId: string): Promise<boolean> {
  const pins = await listPinsForFolder(folderId);
  const pinned = pins.some((p) => p.fileId === fileId);
  if (pinned) {
    await unpinItem(folderId, fileId);
    return false;
  }
  await pinItem(folderId, fileId);
  return true;
}

export async function migrateRootPinsToDashboard(): Promise<void> {
  if (typeof window === "undefined") return;
  const rootPins = await listPinsForFolder("root");
  if (!rootPins.length) return;
  for (const row of rootPins) {
    await pinItem(DASHBOARD_PINS_KEY, row.fileId);
    await unpinItem("root", row.fileId);
  }
}
