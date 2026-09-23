/**
 * IndexedDB-backed cache for thumbnail blobs.
 *
 * - Keyed by `${fileId}:${modifiedTime}` so edits invalidate naturally.
 * - Stores Blob directly (IDB supports binary; localStorage doesn't).
 * - Eviction: when entry count exceeds MAX_ENTRIES, oldest are deleted.
 * - All ops are no-ops if IDB isn't available (private browsing, very old browsers).
 */

const DB_NAME = "drive-ui-cache";
const DB_VERSION = 1;
const STORE = "thumbnails";
const MAX_ENTRIES = 500;

interface Entry {
  key: string;
  blob: Blob;
  storedAt: number;
}

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    if (typeof indexedDB === "undefined") {
      resolve(null);
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "key" });
        store.createIndex("storedAt", "storedAt");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      console.warn("[cache] IDB open failed:", req.error);
      resolve(null);
    };
  });
  return dbPromise;
}

function makeKey(fileId: string, modifiedTime?: string): string {
  return `${fileId}:${modifiedTime || ""}`;
}

export async function getCachedBlob(fileId: string, modifiedTime?: string): Promise<Blob | null> {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(makeKey(fileId, modifiedTime));
      req.onsuccess = () => resolve((req.result as Entry | undefined)?.blob || null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function setCachedBlob(fileId: string, modifiedTime: string | undefined, blob: Blob): Promise<void> {
  const db = await openDb();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put({
        key: makeKey(fileId, modifiedTime),
        blob,
        storedAt: Date.now(),
      } as Entry);
      tx.oncomplete = () => {
        evictIfNeeded(db).finally(() => resolve());
      };
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

async function evictIfNeeded(db: IDBDatabase): Promise<void> {
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, "readwrite");
      const store = tx.objectStore(STORE);
      const countReq = store.count();
      countReq.onsuccess = () => {
        const excess = countReq.result - MAX_ENTRIES;
        if (excess <= 0) { resolve(); return; }
        // Delete oldest entries by storedAt index
        const index = store.index("storedAt");
        const cursorReq = index.openCursor();
        let deleted = 0;
        cursorReq.onsuccess = () => {
          const cursor = cursorReq.result;
          if (!cursor || deleted >= excess) { resolve(); return; }
          cursor.delete();
          deleted++;
          cursor.continue();
        };
        cursorReq.onerror = () => resolve();
      };
      countReq.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

/** Clear the entire cache. Useful for sign-out. */
export async function clearCache(): Promise<void> {
  const db = await openDb();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}