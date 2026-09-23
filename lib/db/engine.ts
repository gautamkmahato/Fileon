import {
  PG_DB_NAME,
  PG_DB_VERSION,
  PG_TABLES,
  type CleanupDecisionRow,
  type CleanupFileRow,
  type CleanupFindingRow,
  type CleanupGroupRow,
  type CleanupHealthRow,
  type CleanupScanRow,
  type CleanupSyncStateRow,
  type PgTable,
  type ShareLinkRow,
  type SmartSpaceRow,
  type SmartSpaceRuleRow,
} from "./schema";

type RowByTable = {
  cleanup_scans: CleanupScanRow;
  cleanup_files: CleanupFileRow;
  cleanup_groups: CleanupGroupRow;
  cleanup_findings: CleanupFindingRow;
  cleanup_health: CleanupHealthRow;
  cleanup_decisions: CleanupDecisionRow;
  cleanup_sync_state: CleanupSyncStateRow;
  smart_spaces: SmartSpaceRow;
  smart_space_rules: SmartSpaceRuleRow;
  share_links: ShareLinkRow;
};

type Key = IDBValidKey;

const KEY_PATH: Record<PgTable, string | string[]> = {
  cleanup_scans: "id",
  cleanup_files: ["user_id", "file_id"],
  cleanup_groups: "id",
  cleanup_findings: "id",
  cleanup_health: ["user_id", "scan_id"],
  cleanup_decisions: ["user_id", "file_id", "detector"],
  cleanup_sync_state: "user_id",
  smart_spaces: "id",
  smart_space_rules: "id",
  share_links: "id",
};

let dbPromise: Promise<IDBDatabase> | null = null;
let memoryOnly = false;
const memory = new Map<PgTable, Map<string, unknown>>();

function memoryMap(table: PgTable): Map<string, unknown> {
  let map = memory.get(table);
  if (!map) {
    map = new Map();
    memory.set(table, map);
  }
  return map;
}

function encodeKey(key: Key): string {
  return Array.isArray(key) ? key.map(String).join("\u001f") : String(key);
}

function rowKey(table: PgTable, row: object): Key {
  const path = KEY_PATH[table];
  const rec = row as Record<string, string>;
  if (Array.isArray(path)) return path.map((field) => rec[field]);
  return rec[path];
}

function openDb(): Promise<IDBDatabase> {
  if (memoryOnly) return Promise.reject(new Error("IndexedDB unavailable"));
  if (typeof indexedDB === "undefined") {
    memoryOnly = true;
    return Promise.reject(new Error("IndexedDB unavailable"));
  }
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    let req: IDBOpenDBRequest;
    try {
      req = indexedDB.open(PG_DB_NAME, PG_DB_VERSION);
    } catch (err) {
      memoryOnly = true;
      dbPromise = null;
      reject(err);
      return;
    }

    req.onupgradeneeded = () => {
      const db = req.result;
      for (const table of PG_TABLES) {
        if (db.objectStoreNames.contains(table)) continue;
        const store = db.createObjectStore(table, { keyPath: KEY_PATH[table] });
        if (table !== "cleanup_sync_state") {
          store.createIndex("user_id", "user_id", { unique: false });
        }
        if (table === "cleanup_scans") {
          store.createIndex("user_finished", ["user_id", "finished_at"], { unique: false });
        }
        if (table === "cleanup_groups" || table === "cleanup_findings") {
          store.createIndex("scan_id", ["user_id", "scan_id"], { unique: false });
        }
        if (table === "cleanup_findings") {
          store.createIndex("detector", ["user_id", "scan_id", "detector"], { unique: false });
        }
        if (table === "cleanup_files") {
          store.createIndex("md5", ["user_id", "md5"], { unique: false });
        }
        if (table === "smart_spaces") {
          store.createIndex("user_order", ["user_id", "sort_order"], { unique: false });
        }
        if (table === "smart_space_rules") {
          store.createIndex("space_id", ["user_id", "space_id"], { unique: false });
        }
        if (table === "share_links") {
          store.createIndex("token", "token", { unique: true });
          store.createIndex("file_id", ["user_id", "file_id"], { unique: false });
        }
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      memoryOnly = true;
      dbPromise = null;
      reject(req.error ?? new Error("IndexedDB open failed"));
    };
  });

  return dbPromise;
}

function requestToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore<T>(
  table: PgTable,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => Promise<T> | T,
): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(table, mode);
    const store = tx.objectStore(table);
    Promise.resolve(fn(store)).then(resolve, reject);
    tx.onerror = () => reject(tx.error);
  });
}

export function isMemoryOnly(): boolean {
  return memoryOnly;
}

export async function pgUpsert<T extends PgTable>(table: T, row: RowByTable[T]): Promise<void> {
  const key = encodeKey(rowKey(table, row));
  memoryMap(table).set(key, row);
  if (memoryOnly) return;
  try {
    await withStore(table, "readwrite", (store) => requestToPromise(store.put(row)));
  } catch {
    memoryOnly = true;
  }
}

export async function pgUpsertMany<T extends PgTable>(table: T, rows: RowByTable[T][]): Promise<void> {
  for (const row of rows) {
    memoryMap(table).set(encodeKey(rowKey(table, row)), row);
  }
  if (memoryOnly || rows.length === 0) return;
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(table, "readwrite");
      const store = tx.objectStore(table);
      for (const row of rows) store.put(row);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    memoryOnly = true;
  }
}

export async function pgDelete<T extends PgTable>(table: T, key: Key): Promise<void> {
  memoryMap(table).delete(encodeKey(key));
  if (memoryOnly) return;
  try {
    await withStore(table, "readwrite", (store) => requestToPromise(store.delete(key)));
  } catch {
    memoryOnly = true;
  }
}

export async function pgGet<T extends PgTable>(table: T, key: Key): Promise<RowByTable[T] | null> {
  const cached = memoryMap(table).get(encodeKey(key)) as RowByTable[T] | undefined;
  if (cached) return cached;
  if (memoryOnly) return null;
  try {
    const row = await withStore(table, "readonly", (store) => requestToPromise(store.get(key)));
    if (row) memoryMap(table).set(encodeKey(key), row);
    return (row as RowByTable[T] | undefined) ?? null;
  } catch {
    memoryOnly = true;
    return null;
  }
}

export async function pgSelectByUser<T extends PgTable>(
  table: T,
  userId: string,
): Promise<RowByTable[T][]> {
  const fromMem = [...memoryMap(table).values()].filter((row) => {
    const r = row as { user_id?: string };
    return r.user_id === userId;
  }) as RowByTable[T][];

  if (memoryOnly) return fromMem;

  try {
    const rows = await withStore(table, "readonly", async (store) => {
      if (table === "cleanup_sync_state") {
        const one = await requestToPromise(store.get(userId));
        return one ? [one] : [];
      }
      const index = store.index("user_id");
      return requestToPromise(index.getAll(userId));
    });
    const list = (rows as RowByTable[T][]) ?? [];
    for (const row of list) {
      memoryMap(table).set(encodeKey(rowKey(table, row)), row);
    }
    return list;
  } catch {
    memoryOnly = true;
    return fromMem;
  }
}

export async function pgDeleteByUser(table: PgTable, userId: string): Promise<void> {
  const rows = await pgSelectByUser(table, userId);
  for (const row of rows) {
    await pgDelete(table, rowKey(table, row));
  }
}

export async function pgReplaceUserRows<T extends PgTable>(
  table: T,
  userId: string,
  rows: RowByTable[T][],
): Promise<void> {
  await pgDeleteByUser(table, userId);
  await pgUpsertMany(table, rows);
}

export async function pgGetByIndex<T extends PgTable>(
  table: T,
  indexName: string,
  value: IDBValidKey,
): Promise<RowByTable[T] | null> {
  const fromMem = [...memoryMap(table).values()].find((row) => {
    const rec = row as Record<string, unknown>;
    return rec[indexName] === value;
  }) as RowByTable[T] | undefined;
  if (fromMem) return fromMem;
  if (memoryOnly) return null;
  try {
    const row = await withStore(table, "readonly", (store) => {
      const index = store.index(indexName);
      return requestToPromise(index.get(value));
    });
    if (row) memoryMap(table).set(encodeKey(rowKey(table, row as object)), row);
    return (row as RowByTable[T] | undefined) ?? null;
  } catch {
    return fromMem ?? null;
  }
}

export function pgClearMemory(): void {
  memory.clear();
}
