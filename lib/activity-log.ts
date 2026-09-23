import type { UndoActionType } from "./undo";
import {
  openLocalDb, STORE_ACTIVITY, withStore,
} from "./local-db";

export type ActivityType =
  | "rename"
  | "move"
  | "trash"
  | "restore"
  | "delete-forever"
  | "star"
  | "unstar"
  | "pin"
  | "unpin"
  | "hide"
  | "unhide"
  | "share-enable"
  | "share-disable"
  | "share-link-create"
  | "share-link-revoke"
  | "upload"
  | "create-folder"
  | "download"
  | "tag-create"
  | "tag-update"
  | "tag-delete"
  | "tag-add"
  | "tag-remove";

export interface ActivityUndoData {
  type: UndoActionType;
  fileIds: string[];
  oldNames?: string[];
  newNames?: string[];
  oldParentIds?: string[];
  newParentId?: string;
}

export interface ActivityEntry {
  id: string;
  type: ActivityType;
  timestamp: number;
  description: string;
  fileIds: string[];
  fileNames: string[];
  folderContext?: string;
  undoData?: ActivityUndoData;
  undone?: boolean;
}

export type ActivityFilterType = "all" | ActivityType | "renames" | "moves" | "trash-actions" | "shares" | "uploads" | "creates" | "tags" | "pins";

export type ActivityDateRange = "today" | "week" | "month" | "all";

export interface GetActivityOpts {
  limit?: number;
  before?: number;
  filter?: ActivityFilterType;
  dateRange?: ActivityDateRange;
  search?: string;
}

const PRUNE_MS = 90 * 24 * 60 * 60 * 1000;
const HISTORY_UNDO_MS = 5 * 60 * 1000;

const PAUSE_KEY = "activity_logging_paused";
const ONBOARDING_KEY = "activity_onboarding_seen";

let idCounter = 0;

const undoRegistry = new Map<string, { undo: () => Promise<void>; expiresAt: number }>();
type ActivityListener = (entry: ActivityEntry) => void;
const listeners = new Set<ActivityListener>();

async function pruneOldEntries(): Promise<void> {
  const cutoff = Date.now() - PRUNE_MS;
  const db = await openLocalDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_ACTIVITY, "readwrite");
    const store = tx.objectStore(STORE_ACTIVITY);
    const index = store.index("timestamp");
    const range = IDBKeyRange.upperBound(cutoff);
    const req = index.openCursor(range);
    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor) {
        store.delete(cursor.primaryKey);
        cursor.continue();
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function dateRangeStart(range: ActivityDateRange): number | null {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  switch (range) {
    case "today": return startOfDay;
    case "week": return startOfDay - 6 * 24 * 60 * 60 * 1000;
    case "month": return startOfDay - 29 * 24 * 60 * 60 * 1000;
    default: return null;
  }
}

function matchesFilter(entry: ActivityEntry, filter: ActivityFilterType): boolean {
  if (filter === "all") return true;
  if (filter === "renames") return entry.type === "rename";
  if (filter === "moves") return entry.type === "move";
  if (filter === "trash-actions") return entry.type === "trash" || entry.type === "restore" || entry.type === "delete-forever";
  if (filter === "shares") {
    return entry.type === "share-enable" || entry.type === "share-disable"
      || entry.type === "share-link-create" || entry.type === "share-link-revoke";
  }
  if (filter === "uploads") return entry.type === "upload";
  if (filter === "creates") return entry.type === "create-folder";
  if (filter === "pins") return entry.type === "pin" || entry.type === "unpin";
  if (filter === "tags") {
    return entry.type === "tag-create" || entry.type === "tag-update"
      || entry.type === "tag-delete" || entry.type === "tag-add" || entry.type === "tag-remove";
  }
  return entry.type === filter;
}

function matchesSearch(entry: ActivityEntry, q: string): boolean {
  if (!q) return true;
  const lower = q.toLowerCase();
  if (entry.description.toLowerCase().includes(lower)) return true;
  return entry.fileNames.some((n) => n.toLowerCase().includes(lower));
}

export function isLoggingPaused(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(PAUSE_KEY) === "true";
}

export function setLoggingPaused(paused: boolean): void {
  localStorage.setItem(PAUSE_KEY, paused ? "true" : "false");
}

export function hasSeenActivityOnboarding(): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(ONBOARDING_KEY) === "true";
}

export function markActivityOnboardingSeen(): void {
  localStorage.setItem(ONBOARDING_KEY, "true");
}

export function subscribeActivity(fn: ActivityListener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function registerActivityUndo(activityId: string, undo: () => Promise<void>): void {
  undoRegistry.set(activityId, { undo, expiresAt: Date.now() + HISTORY_UNDO_MS });
}

export function canUndoActivity(activityId: string, entry: ActivityEntry): boolean {
  if (entry.undone || !entry.undoData) return false;
  if (Date.now() - entry.timestamp > HISTORY_UNDO_MS) return false;
  const reg = undoRegistry.get(activityId);
  return !!reg && reg.expiresAt > Date.now();
}

export async function executeActivityUndo(activityId: string): Promise<boolean> {
  const reg = undoRegistry.get(activityId);
  if (!reg || reg.expiresAt < Date.now()) return false;
  const { toast: sonner } = await import("sonner");
  const loadingId = sonner.loading("Undoing…");
  try {
    await reg.undo();
    await markUndone(activityId);
    undoRegistry.delete(activityId);
    sonner.success("Undone", { id: loadingId, duration: 3000 });
    return true;
  } catch (err) {
    console.error(err);
    sonner.error("Undo failed", { id: loadingId });
    return false;
  }
}

export async function logActivity(
  entry: Omit<ActivityEntry, "id" | "timestamp" | "undone">
): Promise<string | null> {
  if (isLoggingPaused()) return null;
  await pruneOldEntries();

  const full: ActivityEntry = {
    ...entry,
    id: `act-${Date.now()}-${++idCounter}`,
    timestamp: Date.now(),
    undone: false,
  };

  await withStore(STORE_ACTIVITY, "readwrite", (store) => store.put(full));
  listeners.forEach((fn) => fn(full));
  return full.id;
}

export async function getActivity(opts: GetActivityOpts = {}): Promise<ActivityEntry[]> {
  if (typeof window === "undefined") return [];
  await pruneOldEntries();

  const limit = opts.limit ?? 50;
  const rangeStart = opts.dateRange ? dateRangeStart(opts.dateRange) : null;

  const all = await withStore(STORE_ACTIVITY, "readonly", (store) => store.index("timestamp").getAll());
  let filtered = all as ActivityEntry[];

  filtered.sort((a, b) => b.timestamp - a.timestamp);

  if (opts.before !== undefined) {
    const before = opts.before;
    filtered = filtered.filter((e) => e.timestamp < before);
  }
  if (rangeStart) filtered = filtered.filter((e) => e.timestamp >= rangeStart);
  if (opts.filter && opts.filter !== "all") {
    filtered = filtered.filter((e) => matchesFilter(e, opts.filter!));
  }
  if (opts.search?.trim()) {
    filtered = filtered.filter((e) => matchesSearch(e, opts.search!.trim()));
  }

  return filtered.slice(0, limit);
}

export async function markUndone(id: string): Promise<void> {
  const entry = await withStore(STORE_ACTIVITY, "readonly", (store) => store.get(id)) as ActivityEntry | undefined;
  if (!entry) return;
  const updated = { ...entry, undone: true };
  await withStore(STORE_ACTIVITY, "readwrite", (store) => store.put(updated));
  undoRegistry.delete(id);
  listeners.forEach((fn) => fn(updated));
}

export async function clearActivity(): Promise<void> {
  await withStore(STORE_ACTIVITY, "readwrite", (store) => store.clear());
  undoRegistry.clear();
  listeners.forEach(() => {});
}

/** Log + register undo for reversible actions (pairs with pushUndo). */
export async function prepareActivityUndo(opts: {
  type: ActivityType;
  description: string;
  fileIds: string[];
  fileNames: string[];
  folderContext?: string;
  undoData?: ActivityUndoData;
  undo: () => Promise<void>;
}): Promise<string | null> {
  const id = await logActivity({
    type: opts.type,
    description: opts.description,
    fileIds: opts.fileIds,
    fileNames: opts.fileNames,
    folderContext: opts.folderContext,
    undoData: opts.undoData,
  });
  if (id) registerActivityUndo(id, opts.undo);
  return id;
}

export { HISTORY_UNDO_MS };
