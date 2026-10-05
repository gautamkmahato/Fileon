import type { DriveFile } from "@/lib/drive/drive";

export interface FilesCacheEntry {
  files: DriveFile[];
  nextPageToken?: string;
  fetchedAt: number;
}

/** How long cached lists stay fresh without a background refetch. */
const FILES_CACHE_STALE_MS = 180_000;

/**
 * Same-tab snapshot so a full load of the homepage does not wipe the last lists.
 * Metadata only — file bytes stay in Drive. Cleared on sign-out.
 */
const STORAGE_KEY = "fileon.fileListSnapshot";
const STORAGE_VERSION = 1;
const MAX_ENTRIES = 10;
const MAX_FILES_PER_ENTRY = 400;
const MAX_JSON_CHARS = 1_500_000;

/** Fields the list and preview need before Drive answers. Owner emails are omitted. */
type SlimFile = Pick<
  DriveFile,
  | "id"
  | "name"
  | "mimeType"
  | "iconLink"
  | "thumbnailLink"
  | "webViewLink"
  | "modifiedTime"
  | "createdTime"
  | "size"
  | "shared"
  | "starred"
  | "trashed"
  | "parents"
  | "capabilities"
  | "shortcutDetails"
>;

interface StoredEntry {
  files: SlimFile[];
  nextPageToken?: string;
  fetchedAt: number;
}

interface StoredSnapshot {
  v: number;
  userId: string | null;
  order: string[];
  entries: Record<string, StoredEntry>;
}

const cache = new Map<string, FilesCacheEntry>();
const order: string[] = [];
/** Keys filled from sessionStorage. Stay set until a live Drive response replaces them. */
const restoredFromSession = new Set<string>();

let sessionLoaded = false;
let storedUserId: string | null = null;
let activeUserId: string | null = null;
let closed = false;
let persistGen = 0;
let persistTimer: ReturnType<typeof setTimeout> | null = null;
let flushInstalled = false;

export function getFilesCache(key: string): FilesCacheEntry | undefined {
  ensureSessionLoaded();
  return cache.get(key);
}

export function filesCacheRestoredFromSession(key: string): boolean {
  return restoredFromSession.has(key);
}

export function setFilesCache(
  key: string,
  data: { files: DriveFile[]; nextPageToken?: string }
): void {
  if (closed) return;
  ensureSessionLoaded();
  cache.set(key, { files: data.files, nextPageToken: data.nextPageToken, fetchedAt: Date.now() });
  restoredFromSession.delete(key);
  touchOrder(key);
  schedulePersist();
}

export function isFilesCacheFresh(entry: FilesCacheEntry): boolean {
  return Date.now() - entry.fetchedAt < FILES_CACHE_STALE_MS;
}

/** Allow writes again after a new sign-in. */
export function openFilesListSnapshot(): void {
  closed = false;
}

/** Bind the snapshot to the signed-in Google user. Drops another user's lists. */
export function setFilesCacheUser(userId: string | null): void {
  activeUserId = userId;
  if (!userId) return;
  ensureSessionLoaded();
  if (storedUserId && storedUserId !== userId) {
    clearFilesListSnapshot();
    closed = false;
    activeUserId = userId;
    storedUserId = userId;
    return;
  }
  if (storedUserId !== userId) {
    storedUserId = userId;
    schedulePersist();
  }
}

/** Forget every cached list but keep writing. Used after the user grants more files. */
export function invalidateFilesCache(): void {
  ensureSessionLoaded();
  cache.clear();
  order.length = 0;
  restoredFromSession.clear();
  schedulePersist();
}

/** Drop one cached list so the next navigation refetches (e.g. inbox after upload). */
export function invalidateFilesCacheKey(key: string): void {
  ensureSessionLoaded();
  if (!cache.delete(key)) return;
  const idx = order.indexOf(key);
  if (idx >= 0) order.splice(idx, 1);
  restoredFromSession.delete(key);
  schedulePersist();
}

/** Drop the in-memory lists and the session snapshot. */
export function clearFilesListSnapshot(): void {
  persistGen += 1;
  closed = true;
  if (persistTimer != null) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  cache.clear();
  order.length = 0;
  restoredFromSession.clear();
  storedUserId = null;
  activeUserId = null;
  sessionLoaded = true;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // sessionStorage can be unavailable in private mode.
  }
}

function touchOrder(key: string): void {
  const idx = order.indexOf(key);
  if (idx >= 0) order.splice(idx, 1);
  order.push(key);
  // The memory map keeps every list visited this page. Only the snapshot is capped.
  while (order.length > MAX_ENTRIES) order.shift();
}

function ensureSessionLoaded(): void {
  if (sessionLoaded) return;
  sessionLoaded = true;
  installFlush();
  if (typeof sessionStorage === "undefined") return;
  let parsed: StoredSnapshot | null = null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    parsed = JSON.parse(raw) as StoredSnapshot;
  } catch {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    return;
  }
  if (!parsed || parsed.v !== STORAGE_VERSION || !parsed.entries) {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    return;
  }
  if (activeUserId && parsed.userId && parsed.userId !== activeUserId) {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    return;
  }
  storedUserId = parsed.userId ?? null;
  const keys = Array.isArray(parsed.order) ? parsed.order : Object.keys(parsed.entries);
  for (const key of keys) {
    if (order.includes(key) || order.length >= MAX_ENTRIES) continue;
    const entry = parsed.entries[key];
    if (!entry || !Array.isArray(entry.files)) continue;
    cache.set(key, {
      files: entry.files,
      nextPageToken: entry.nextPageToken,
      fetchedAt: entry.fetchedAt || 0,
    });
    order.push(key);
    restoredFromSession.add(key);
  }
}

function schedulePersist(): void {
  installFlush();
  if (closed || typeof sessionStorage === "undefined") return;
  if (persistTimer != null) return;
  const gen = persistGen;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    if (gen !== persistGen || closed) return;
    writeSession();
  }, 50);
}

function installFlush(): void {
  if (flushInstalled || typeof window === "undefined") return;
  flushInstalled = true;
  window.addEventListener("pagehide", () => {
    if (persistTimer != null) {
      clearTimeout(persistTimer);
      persistTimer = null;
    }
    if (!closed) writeSession();
  });
}

function writeSession(): void {
  if (closed || typeof sessionStorage === "undefined") return;
  const entries: Record<string, StoredEntry> = {};
  for (const key of order) {
    const entry = cache.get(key);
    if (!entry) continue;
    entries[key] = {
      files: entry.files.slice(0, MAX_FILES_PER_ENTRY).map(slimFile),
      nextPageToken: entry.nextPageToken,
      fetchedAt: entry.fetchedAt,
    };
  }
  let payload: StoredSnapshot = {
    v: STORAGE_VERSION,
    userId: storedUserId ?? activeUserId,
    order: order.filter((key) => entries[key]),
    entries,
  };
  try {
    let json = JSON.stringify(payload);
    while (json.length > MAX_JSON_CHARS && payload.order.length > 1) {
      const oldest = payload.order[0];
      payload = {
        ...payload,
        order: payload.order.slice(1),
        entries: omitKey(payload.entries, oldest),
      };
      json = JSON.stringify(payload);
    }
    if (json.length > MAX_JSON_CHARS && payload.order.length === 1) {
      const only = payload.order[0];
      let files = payload.entries[only].files;
      while (files.length > 20 && json.length > MAX_JSON_CHARS) {
        files = files.slice(0, Math.floor(files.length * 0.7));
        payload = {
          ...payload,
          entries: { [only]: { ...payload.entries[only], files } },
        };
        json = JSON.stringify(payload);
      }
    }
    if (json.length > MAX_JSON_CHARS) return;
    sessionStorage.setItem(STORAGE_KEY, json);
  } catch {
    // Quota or private mode — the in-memory map still serves this page.
  }
}

function omitKey(entries: Record<string, StoredEntry>, key: string): Record<string, StoredEntry> {
  const next: Record<string, StoredEntry> = {};
  for (const [k, value] of Object.entries(entries)) {
    if (k !== key) next[k] = value;
  }
  return next;
}

function slimFile(file: DriveFile): SlimFile {
  const slim: SlimFile = {
    id: file.id,
    name: file.name,
    mimeType: file.mimeType,
  };
  if (file.iconLink) slim.iconLink = file.iconLink;
  if (file.thumbnailLink) slim.thumbnailLink = file.thumbnailLink;
  if (file.webViewLink) slim.webViewLink = file.webViewLink;
  if (file.modifiedTime) slim.modifiedTime = file.modifiedTime;
  if (file.createdTime) slim.createdTime = file.createdTime;
  if (file.size) slim.size = file.size;
  if (file.shared) slim.shared = true;
  if (file.starred) slim.starred = true;
  if (file.trashed) slim.trashed = true;
  if (file.parents?.length) slim.parents = file.parents;
  if (file.capabilities) slim.capabilities = file.capabilities;
  if (file.shortcutDetails) slim.shortcutDetails = file.shortcutDetails;
  return slim;
}
