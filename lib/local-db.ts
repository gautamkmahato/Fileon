export const DB_NAME = "gdrive-activity";
export const DB_VERSION = 8;

export const STORE_ACTIVITY = "activity";
export const STORE_TAGS = "tags";
export const STORE_FILE_TAGS = "file_tags";
export const STORE_VIEWS = "views";
export const STORE_PINS = "pins";
export const STORE_HIDDEN = "hidden";
export const STORE_FOLDER_COVERS = "folder_covers";
export const STORE_FOLDER_FAVORITES = "folder_favorites";
export const STORE_INBOX = "inbox";

let dbPromise: Promise<IDBDatabase> | null = null;

export function openLocalDb(): Promise<IDBDatabase> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("IndexedDB unavailable"));
  }
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_ACTIVITY)) {
        const store = db.createObjectStore(STORE_ACTIVITY, { keyPath: "id" });
        store.createIndex("timestamp", "timestamp", { unique: false });
        store.createIndex("type", "type", { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_TAGS)) {
        db.createObjectStore(STORE_TAGS, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORE_FILE_TAGS)) {
        const ft = db.createObjectStore(STORE_FILE_TAGS, { keyPath: "key" });
        ft.createIndex("fileId", "fileId", { unique: false });
        ft.createIndex("tagId", "tagId", { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_VIEWS)) {
        const vs = db.createObjectStore(STORE_VIEWS, { keyPath: "id" });
        vs.createIndex("order", "order", { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_PINS)) {
        const ps = db.createObjectStore(STORE_PINS, { keyPath: "key" });
        ps.createIndex("folderId", "folderId", { unique: false });
        ps.createIndex("fileId", "fileId", { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_HIDDEN)) {
        db.createObjectStore(STORE_HIDDEN, { keyPath: "fileId" });
      }
      if (!db.objectStoreNames.contains(STORE_FOLDER_COVERS)) {
        db.createObjectStore(STORE_FOLDER_COVERS, { keyPath: "folderId" });
      }
      if (!db.objectStoreNames.contains(STORE_FOLDER_FAVORITES)) {
        db.createObjectStore(STORE_FOLDER_FAVORITES, { keyPath: "folderId" });
      }
      if (!db.objectStoreNames.contains(STORE_INBOX)) {
        db.createObjectStore(STORE_INBOX, { keyPath: "fileId" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

export async function withStore<T>(
  storeName: string,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  const db = await openLocalDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    const req = fn(store);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
