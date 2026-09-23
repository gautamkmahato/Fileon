import {
  CLEANUP_FILE_FIELDS,
  DriveApiError,
  getDriveStartPageToken,
  isFolder,
  isShortcut,
  listFilesByQuery,
  probeFileAccess,
  type DriveFile,
} from "@/lib/drive/drive";

export const CLEANUP_SCAN_CAP = 2500;
export const CLEANUP_PAGE_SIZE = 100;
const SCAN_HALF = 1250;
const PROBE_CONCURRENCY = 4;
const MAX_SHORTCUT_PROBES = 80;
const MAX_EMPTY_PROBES = 80;

export interface CleanupScanProgress {
  listed: number;
  phase: "listing" | "shortcuts" | "folders";
}

export interface CleanupScanPayload {
  files: DriveFile[];
  truncated: boolean;
  brokenTargetIds: string[];
  verifiedEmptyFolderIds: string[];
  inaccessibleIds: string[];
  drivePageToken: string | null;
}

function mergeById(chunks: DriveFile[][]): DriveFile[] {
  const map = new Map<string, DriveFile>();
  for (const chunk of chunks) {
    for (const file of chunk) {
      if (!file?.id) continue;
      if (!map.has(file.id)) map.set(file.id, file);
    }
  }
  return [...map.values()];
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    const err = new Error("Cleanup scan cancelled");
    err.name = "AbortError";
    throw err;
  }
}

async function listPass(opts: {
  token: string;
  orderBy: string;
  cap: number;
  signal?: AbortSignal;
  onListed?: (n: number) => void;
}): Promise<{ files: DriveFile[]; truncated: boolean }> {
  const files: DriveFile[] = [];
  let pageToken: string | undefined;
  let pages = 0;
  const maxPages = Math.ceil(opts.cap / CLEANUP_PAGE_SIZE) + 1;

  while (files.length < opts.cap && pages < maxPages) {
    throwIfAborted(opts.signal);
    const res = await listFilesByQuery({
      token: opts.token,
      q: "trashed = false",
      pageSize: CLEANUP_PAGE_SIZE,
      pageToken,
      orderBy: opts.orderBy,
      fileFields: CLEANUP_FILE_FIELDS,
    });
    const batch = res.files ?? [];
    files.push(...batch);
    opts.onListed?.(files.length);
    pages += 1;
    pageToken = res.nextPageToken;
    if (!pageToken || batch.length === 0) {
      return { files: files.slice(0, opts.cap), truncated: false };
    }
  }

  return { files: files.slice(0, opts.cap), truncated: !!pageToken || files.length >= opts.cap };
}

async function mapPool<T, R>(
  items: T[],
  limit: number,
  signal: AbortSignal | undefined,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = [];
  let index = 0;

  async function worker() {
    while (index < items.length) {
      throwIfAborted(signal);
      const current = index++;
      out[current] = await fn(items[current]);
    }
  }

  const workers = Array.from({ length: Math.min(limit, Math.max(1, items.length)) }, () => worker());
  await Promise.all(workers);
  return out;
}

export async function scanDriveForCleanup(opts: {
  token: string;
  signal?: AbortSignal;
  onProgress?: (progress: CleanupScanProgress) => void;
}): Promise<CleanupScanPayload> {
  const { token, signal, onProgress } = opts;
  if (!token) {
    return {
      files: [],
      truncated: false,
      brokenTargetIds: [],
      verifiedEmptyFolderIds: [],
      inaccessibleIds: [],
      drivePageToken: null,
    };
  }

  const drivePageToken = await getDriveStartPageToken(token);

  let listed = 0;
  const report = (phase: CleanupScanProgress["phase"], n = listed) => {
    listed = n;
    onProgress?.({ listed, phase });
  };

  const recent = await listPass({
    token,
    orderBy: "modifiedTime desc",
    cap: SCAN_HALF,
    signal,
    onListed: (n) => report("listing", n),
  });

  const oldest = await listPass({
    token,
    orderBy: "modifiedTime asc",
    cap: SCAN_HALF,
    signal,
    onListed: (n) => report("listing", recent.files.length + n),
  });

  const files = mergeById([recent.files, oldest.files]).slice(0, CLEANUP_SCAN_CAP);
  const truncated = files.length >= CLEANUP_SCAN_CAP;
  report("listing", files.length);

  const byId = new Set(files.map((f) => f.id));
  const shortcutTargets = files
    .filter(isShortcut)
    .map((f) => f.shortcutDetails?.targetId)
    .filter((id): id is string => !!id && !byId.has(id))
    .slice(0, MAX_SHORTCUT_PROBES);

  report("shortcuts", files.length);
  const brokenTargetIds: string[] = [];
  const inaccessibleIds: string[] = [];

  try {
    await mapPool(shortcutTargets, PROBE_CONCURRENCY, signal, async (targetId) => {
      const status = await probeFileAccess(token, targetId);
      if (status === "missing" || status === "forbidden") brokenTargetIds.push(targetId);
      if (status === "forbidden") inaccessibleIds.push(targetId);
    });
  } catch (err) {
    if (err instanceof DriveApiError && err.status === 401) throw err;
    if ((err as { name?: string })?.name === "AbortError") throw err;
  }

  const children = new Map<string, number>();
  for (const file of files) {
    for (const parent of file.parents ?? []) {
      children.set(parent, (children.get(parent) ?? 0) + 1);
    }
  }

  const emptyCandidates = files
    .filter(isFolder)
    .filter((f) => (children.get(f.id) ?? 0) === 0)
    .slice(0, MAX_EMPTY_PROBES);

  report("folders", files.length);
  const verifiedEmptyFolderIds: string[] = [];
  try {
    await mapPool(emptyCandidates, PROBE_CONCURRENCY, signal, async (folder) => {
      throwIfAborted(signal);
      const res = await listFilesByQuery({
        token,
        q: `'${folder.id.replace(/'/g, "\\'")}' in parents and trashed = false`,
        pageSize: 1,
        orderBy: "modifiedTime desc",
      });
      if ((res.files ?? []).length === 0) verifiedEmptyFolderIds.push(folder.id);
    });
  } catch (err) {
    if (err instanceof DriveApiError && err.status === 401) throw err;
    if ((err as { name?: string })?.name === "AbortError") throw err;
  }

  return {
    files,
    truncated,
    brokenTargetIds,
    verifiedEmptyFolderIds,
    inaccessibleIds,
    drivePageToken,
  };
}
