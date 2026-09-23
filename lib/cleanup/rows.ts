import type { DriveFile } from "@/lib/drive/drive";
import type { CleanupAnalysis, CleanupGroup } from "@/lib/cleanup/types";
import type {
  CleanupFileFlags,
  CleanupFileRow,
  CleanupFindingRow,
  CleanupGroupRow,
  FindingDetector,
} from "@/lib/db/schema";
import { newId, nowIso, parseIso, parseSizeBytes, sanitizeFileId, sanitizeName } from "@/lib/db/sanitize";

export function driveFileToRow(
  userId: string,
  file: DriveFile,
  flags: CleanupFileFlags = {},
  prev?: CleanupFileRow | null,
): CleanupFileRow | null {
  const fileId = sanitizeFileId(file.id);
  if (!fileId) return null;
  const mergedFlags = { ...(prev?.flags ?? {}), ...flags };
  return {
    user_id: userId,
    file_id: fileId,
    name: sanitizeName(file.name),
    mime_type: (file.mimeType || "application/octet-stream").slice(0, 256),
    size_bytes: parseSizeBytes(file.size),
    md5: file.md5Checksum?.trim().toLowerCase() || null,
    created_at: parseIso(file.createdTime),
    modified_at: parseIso(file.modifiedTime),
    viewed_by_me_at: parseIso(file.viewedByMeTime),
    parents: Array.isArray(file.parents) ? file.parents.map(String).filter(Boolean).slice(0, 32) : [],
    starred: !!file.starred,
    shared: !!file.shared,
    can_edit: file.capabilities?.canEdit ?? null,
    can_download: file.capabilities?.canDownload ?? null,
    shortcut_target_id: sanitizeFileId(file.shortcutDetails?.targetId),
    trashed: !!file.trashed,
    flags: mergedFlags,
    last_seen_at: nowIso(),
  };
}

export function rowToDriveFile(row: CleanupFileRow): DriveFile {
  const file: DriveFile = {
    id: row.file_id,
    name: row.name,
    mimeType: row.mime_type,
    createdTime: row.created_at ?? undefined,
    modifiedTime: row.modified_at ?? undefined,
    viewedByMeTime: row.viewed_by_me_at ?? undefined,
    size: row.size_bytes != null ? String(row.size_bytes) : undefined,
    md5Checksum: row.md5 ?? undefined,
    parents: row.parents,
    starred: row.starred,
    shared: row.shared,
    trashed: row.trashed,
    capabilities: {
      canEdit: row.can_edit ?? undefined,
      canDownload: row.can_download ?? undefined,
    },
  };
  if (row.shortcut_target_id) {
    file.shortcutDetails = { targetId: row.shortcut_target_id };
  }
  return file;
}

export function flagsFromRows(rows: CleanupFileRow[]): {
  brokenTargetIds: Set<string>;
  verifiedEmptyFolderIds: Set<string>;
  inaccessibleIds: Set<string>;
} {
  const brokenTargetIds = new Set<string>();
  const verifiedEmptyFolderIds = new Set<string>();
  const inaccessibleIds = new Set<string>();
  for (const row of rows) {
    if (row.flags.empty_verified) verifiedEmptyFolderIds.add(row.file_id);
    if (row.flags.inaccessible) inaccessibleIds.add(row.file_id);
    if (row.flags.broken_target && row.shortcut_target_id) {
      brokenTargetIds.add(row.shortcut_target_id);
    }
  }
  return { brokenTargetIds, verifiedEmptyFolderIds, inaccessibleIds };
}

function pushGroup(
  userId: string,
  scanId: string,
  detector: FindingDetector,
  group: CleanupGroup,
  groups: CleanupGroupRow[],
  findings: CleanupFindingRow[],
) {
  const groupId = newId();
  groups.push({
    id: groupId,
    user_id: userId,
    scan_id: scanId,
    detector,
    label: group.label.slice(0, 1024),
    reason: group.reason.slice(0, 500),
    family: group.family ?? null,
    keep_file_id: group.files[0]?.id ?? null,
  });
  group.files.forEach((file, rank) => {
    const fileId = sanitizeFileId(file.id);
    if (!fileId) return;
    findings.push({
      id: newId(),
      user_id: userId,
      scan_id: scanId,
      detector,
      file_id: fileId,
      group_id: groupId,
      reason: group.reason.slice(0, 500),
      rank,
      extra: {},
    });
  });
}

export function analysisToRows(
  userId: string,
  scanId: string,
  analysis: CleanupAnalysis,
): { groups: CleanupGroupRow[]; findings: CleanupFindingRow[] } {
  const groups: CleanupGroupRow[] = [];
  const findings: CleanupFindingRow[] = [];

  for (const group of analysis.duplicateGroups) {
    pushGroup(userId, scanId, "duplicates", group, groups, findings);
  }
  for (const group of analysis.sameContentDifferentNames) {
    pushGroup(userId, scanId, "same-content", group, groups, findings);
  }
  for (const group of analysis.nearDuplicateGroups) {
    pushGroup(userId, scanId, "near-duplicates", group, groups, findings);
  }
  for (const group of analysis.duplicateFolders) {
    pushGroup(userId, scanId, "duplicate-folders", group, groups, findings);
  }

  const lists: [FindingDetector, { file: { id: string }; reason: string }[]][] = [
    ["dead", analysis.dead],
    ["stale-6m", analysis.stale6m],
    ["stale-1y", analysis.stale1y],
    ["stale-2y", analysis.stale2y],
    ["unused", analysis.unused],
    ["empty-folders", analysis.emptyFolders],
    ["broken-shortcuts", analysis.brokenShortcuts],
    ["inaccessible", analysis.inaccessible],
    ["orphaned", analysis.orphaned],
    ["unorganized", analysis.unorganized],
    ["redundant", analysis.redundant],
    ["recommendations", analysis.recommendations],
  ];

  for (const [detector, items] of lists) {
    items.forEach((item, rank) => {
      const fileId = sanitizeFileId(item.file.id);
      if (!fileId) return;
      findings.push({
        id: newId(),
        user_id: userId,
        scan_id: scanId,
        detector,
        file_id: fileId,
        group_id: null,
        reason: item.reason.slice(0, 500),
        rank,
        extra: {},
      });
    });
  }

  return { groups, findings };
}
