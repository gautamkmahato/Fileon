import type { DriveFile } from "@/lib/drive/drive";
import { analyzeCleanup } from "@/lib/cleanup/analyze";
import type { CleanupAnalysis, CleanupScanContext } from "@/lib/cleanup/types";
import {
  INCREMENTAL_STALE_MS,
  MAX_FILE_ROWS,
  PG_SCHEMA_VERSION,
  type CleanupFileRow,
  type CleanupScanRow,
  type CleanupSyncStateRow,
  type ScanKind,
} from "@/lib/db/schema";
import {
  pgDelete,
  pgGet,
  pgReplaceUserRows,
  pgSelectByUser,
  pgUpsert,
  pgUpsertMany,
} from "@/lib/db/engine";
import {
  analysisToRows,
  driveFileToRow,
  flagsFromRows,
  rowToDriveFile,
} from "@/lib/cleanup/rows";
import {
  assertUserId,
  newId,
  nowIso,
  sanitizeError,
  sanitizeFileId,
} from "@/lib/db/sanitize";

export interface CleanupSnapshot {
  files: DriveFile[];
  rows: CleanupFileRow[];
  analysis: CleanupAnalysis;
  scan: CleanupScanRow;
  sync: CleanupSyncStateRow;
  truncated: boolean;
}

function extrasFrom(
  rows: CleanupFileRow[],
  extras: Pick<CleanupScanContext, "inboxIds" | "taggedIds">,
  truncated: boolean,
): CleanupScanContext {
  const flags = flagsFromRows(rows);
  return {
    now: Date.now(),
    inboxIds: extras.inboxIds,
    taggedIds: extras.taggedIds,
    truncated,
    ...flags,
  };
}

async function latestCompletedScan(userId: string): Promise<CleanupScanRow | null> {
  const scans = await pgSelectByUser("cleanup_scans", userId);
  const completed = scans
    .filter((s) => s.status === "completed")
    .sort((a, b) => (b.finished_at ?? "").localeCompare(a.finished_at ?? ""));
  return completed[0] ?? null;
}

async function writeFindings(
  userId: string,
  scanId: string,
  analysis: CleanupAnalysis,
): Promise<void> {
  const { groups, findings } = analysisToRows(userId, scanId, analysis);
  await pgReplaceUserRows("cleanup_groups", userId, groups);
  await pgReplaceUserRows("cleanup_findings", userId, findings);
  await pgUpsert("cleanup_health", {
    user_id: userId,
    scan_id: scanId,
    score: analysis.health.score,
    counts: { ...analysis.counts } as Record<string, number>,
    breakdown: analysis.health.breakdown,
    computed_at: nowIso(),
  });
}

export async function loadCleanupSnapshot(
  userId: string,
  extras: Pick<CleanupScanContext, "inboxIds" | "taggedIds">,
): Promise<CleanupSnapshot | null> {
  const uid = assertUserId(userId);
  const sync = await pgGet("cleanup_sync_state", uid);
  const scan = sync?.latest_scan_id
    ? await pgGet("cleanup_scans", sync.latest_scan_id)
    : await latestCompletedScan(uid);
  if (!scan || scan.status !== "completed") return null;

  const rows = (await pgSelectByUser("cleanup_files", uid)).filter((r) => !r.trashed);
  if (!rows.length) return null;

  const files = rows.map(rowToDriveFile);
  const analysis = analyzeCleanup(files, extrasFrom(rows, extras, scan.truncated));
  const syncRow: CleanupSyncStateRow = sync ?? {
    user_id: uid,
    latest_scan_id: scan.id,
    drive_start_page_token: scan.drive_page_token,
    last_incremental_at: null,
    last_full_scan_at: scan.finished_at,
    schema_version: PG_SCHEMA_VERSION,
  };

  return { files, rows, analysis, scan, sync: syncRow, truncated: scan.truncated };
}

export async function persistFullIndex(opts: {
  userId: string;
  files: DriveFile[];
  truncated: boolean;
  drivePageToken: string | null;
  kind: ScanKind;
  extras: Pick<CleanupScanContext, "inboxIds" | "taggedIds">;
  flags?: {
    brokenTargetIds: Set<string>;
    verifiedEmptyFolderIds: Set<string>;
    inaccessibleIds: Set<string>;
  };
}): Promise<CleanupSnapshot> {
  const uid = assertUserId(opts.userId);
  const started = nowIso();
  const scanId = newId();
  const prevRows = await pgSelectByUser("cleanup_files", uid);
  const prevById = new Map(prevRows.map((r) => [r.file_id, r]));

  const flagFor = (file: DriveFile) => {
    const flags = { ...(prevById.get(file.id)?.flags ?? {}) };
    if (opts.flags?.inaccessibleIds.has(file.id)) flags.inaccessible = true;
    if (opts.flags?.verifiedEmptyFolderIds.has(file.id)) flags.empty_verified = true;
    const target = file.shortcutDetails?.targetId;
    if (target && opts.flags?.brokenTargetIds.has(target)) flags.broken_target = true;
    return flags;
  };

  let rows = opts.files
    .map((file) => driveFileToRow(uid, file, flagFor(file), prevById.get(file.id)))
    .filter((row): row is CleanupFileRow => !!row)
    .slice(0, MAX_FILE_ROWS);

  if (opts.truncated) {
    const seen = new Set(rows.map((r) => r.file_id));
    for (const prev of prevRows) {
      if (seen.has(prev.file_id) || prev.trashed) continue;
      rows.push(prev);
      if (rows.length >= MAX_FILE_ROWS) break;
    }
  }

  const files = rows.map(rowToDriveFile);
  const analysis = analyzeCleanup(files, extrasFrom(rows, opts.extras, opts.truncated));
  const finished = nowIso();

  const scan: CleanupScanRow = {
    id: scanId,
    user_id: uid,
    status: "completed",
    started_at: started,
    finished_at: finished,
    file_count: rows.length,
    truncated: opts.truncated,
    error: null,
    schema_version: PG_SCHEMA_VERSION,
    drive_page_token: opts.drivePageToken,
    kind: opts.kind,
  };

  const sync: CleanupSyncStateRow = {
    user_id: uid,
    latest_scan_id: scanId,
    drive_start_page_token: opts.drivePageToken,
    last_incremental_at: opts.kind === "incremental" ? finished : null,
    last_full_scan_at: opts.kind === "full" ? finished : (await pgGet("cleanup_sync_state", uid))?.last_full_scan_at ?? finished,
    schema_version: PG_SCHEMA_VERSION,
  };
  if (opts.kind === "incremental") {
    const prev = await pgGet("cleanup_sync_state", uid);
    sync.last_full_scan_at = prev?.last_full_scan_at ?? finished;
    sync.last_incremental_at = finished;
  }

  if (!opts.truncated && opts.kind === "full") {
    await pgReplaceUserRows("cleanup_files", uid, rows);
  } else {
    await pgUpsertMany("cleanup_files", rows);
  }

  await pgUpsert("cleanup_scans", scan);
  await writeFindings(uid, scanId, analysis);
  await pgUpsert("cleanup_sync_state", sync);

  return { files, rows, analysis, scan, sync, truncated: opts.truncated };
}

export async function persistReanalyze(
  userId: string,
  extras: Pick<CleanupScanContext, "inboxIds" | "taggedIds">,
): Promise<CleanupSnapshot | null> {
  const uid = assertUserId(userId);
  const loaded = await loadCleanupSnapshot(uid, extras);
  if (!loaded) return null;

  const scanId = newId();
  const scan: CleanupScanRow = {
    ...loaded.scan,
    id: scanId,
    kind: "reanalyze",
    status: "completed",
    started_at: nowIso(),
    finished_at: nowIso(),
    schema_version: PG_SCHEMA_VERSION,
    error: null,
  };
  const analysis = analyzeCleanup(loaded.files, extrasFrom(loaded.rows, extras, loaded.truncated));
  await pgUpsert("cleanup_scans", scan);
  await writeFindings(uid, scanId, analysis);
  await pgUpsert("cleanup_sync_state", {
    ...loaded.sync,
    latest_scan_id: scanId,
    schema_version: PG_SCHEMA_VERSION,
  });
  return { ...loaded, analysis, scan };
}

export async function patchCleanupFile(userId: string, file: DriveFile): Promise<void> {
  const uid = assertUserId(userId);
  const fileId = sanitizeFileId(file.id);
  if (!fileId) return;
  const prev = await pgGet("cleanup_files", [uid, fileId]);
  const row = driveFileToRow(uid, file, prev?.flags ?? {}, prev);
  if (!row) return;
  await pgUpsert("cleanup_files", row);
}

export async function removeCleanupFile(userId: string, fileId: string): Promise<void> {
  const uid = assertUserId(userId);
  const id = sanitizeFileId(fileId);
  if (!id) return;
  await pgDelete("cleanup_files", [uid, id]);
}

export async function recordScanFailure(userId: string, kind: ScanKind, message: string): Promise<void> {
  const uid = assertUserId(userId);
  await pgUpsert("cleanup_scans", {
    id: newId(),
    user_id: uid,
    status: "failed",
    started_at: nowIso(),
    finished_at: nowIso(),
    file_count: 0,
    truncated: false,
    error: sanitizeError(message),
    schema_version: PG_SCHEMA_VERSION,
    drive_page_token: null,
    kind,
  });
}

export function shouldIncrementalSync(sync: CleanupSyncStateRow | null | undefined): boolean {
  if (!sync?.drive_start_page_token) return false;
  const last = sync.last_incremental_at ?? sync.last_full_scan_at;
  if (!last) return true;
  const t = Date.parse(last);
  if (!Number.isFinite(t)) return true;
  return Date.now() - t >= INCREMENTAL_STALE_MS;
}

export function shouldFullScan(sync: CleanupSyncStateRow | null | undefined): boolean {
  if (!sync?.latest_scan_id || !sync.last_full_scan_at) return true;
  if (sync.schema_version < PG_SCHEMA_VERSION && !sync.last_full_scan_at) return true;
  return false;
}

export async function applyIncrementalChanges(opts: {
  userId: string;
  extras: Pick<CleanupScanContext, "inboxIds" | "taggedIds">;
  upserts: DriveFile[];
  removedIds: string[];
  drivePageToken: string | null;
}): Promise<CleanupSnapshot> {
  const uid = assertUserId(opts.userId);
  for (const id of opts.removedIds) {
    const fileId = sanitizeFileId(id);
    if (fileId) await pgDelete("cleanup_files", [uid, fileId]);
  }

  const prevRows = await pgSelectByUser("cleanup_files", uid);
  const prevById = new Map(prevRows.map((r) => [r.file_id, r]));
  const upsertRows = opts.upserts
    .filter((f) => !f.trashed)
    .map((file) => driveFileToRow(uid, file, prevById.get(file.id)?.flags ?? {}, prevById.get(file.id)))
    .filter((row): row is CleanupFileRow => !!row);

  if (prevRows.length + upsertRows.length > MAX_FILE_ROWS) {
    await pgUpsertMany("cleanup_files", upsertRows.slice(0, Math.max(0, MAX_FILE_ROWS - prevRows.length)));
  } else {
    await pgUpsertMany("cleanup_files", upsertRows);
  }

  const rows = (await pgSelectByUser("cleanup_files", uid)).filter((r) => !r.trashed).slice(0, MAX_FILE_ROWS);
  const files = rows.map(rowToDriveFile);
  const truncated = rows.length >= MAX_FILE_ROWS;
  const analysis = analyzeCleanup(files, extrasFrom(rows, opts.extras, truncated));
  const finished = nowIso();
  const scanId = newId();
  const prevSync = await pgGet("cleanup_sync_state", uid);

  const scan: CleanupScanRow = {
    id: scanId,
    user_id: uid,
    status: "completed",
    started_at: finished,
    finished_at: finished,
    file_count: rows.length,
    truncated,
    error: null,
    schema_version: PG_SCHEMA_VERSION,
    drive_page_token: opts.drivePageToken,
    kind: "incremental",
  };

  await pgUpsert("cleanup_scans", scan);
  await writeFindings(uid, scanId, analysis);
  await pgUpsert("cleanup_sync_state", {
    user_id: uid,
    latest_scan_id: scanId,
    drive_start_page_token: opts.drivePageToken ?? prevSync?.drive_start_page_token ?? null,
    last_incremental_at: finished,
    last_full_scan_at: prevSync?.last_full_scan_at ?? finished,
    schema_version: PG_SCHEMA_VERSION,
  });

  return {
    files,
    rows,
    analysis,
    scan,
    sync: (await pgGet("cleanup_sync_state", uid))!,
    truncated,
  };
}
