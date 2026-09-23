import {
  isFolder,
  isGoogleNative,
  isShortcut,
  type DriveFile,
} from "@/lib/drive/drive";
import { nameSimilarity, normalizeCleanupName } from "./names";
import type {
  CleanupAnalysis,
  CleanupCounts,
  CleanupFinding,
  CleanupGroup,
  CleanupHealth,
  CleanupScanContext,
  NearDupFamily,
} from "./types";

const DAY = 86_400_000;
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;
const NEW_FILE_GRACE = 14 * DAY;
const DEAD_AGE = 2 * YEAR;
const DEAD_NEVER_VIEWED_AGE = 18 * MONTH;
const UNUSED_IDLE = 6 * MONTH;

const PDF_MIMES = new Set(["application/pdf"]);
const DOC_MIMES = new Set([
  "application/vnd.google-apps.document",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.oasis.opendocument.text",
  "text/plain",
  "application/rtf",
]);

function fileBytes(file: DriveFile): number {
  const n = file.size ? Number(file.size) : 0;
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function parseTime(iso?: string): number {
  if (!iso) return 0;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : 0;
}

export function lastActivityMs(file: DriveFile): number {
  return Math.max(
    parseTime(file.viewedByMeTime),
    parseTime(file.modifiedTime),
    parseTime(file.createdTime),
  );
}

function isNewFile(file: DriveFile, now: number): boolean {
  const created = parseTime(file.createdTime);
  return created > 0 && now - created < NEW_FILE_GRACE;
}

function mimeFamily(file: DriveFile): NearDupFamily {
  const mime = file.mimeType ?? "";
  if (PDF_MIMES.has(mime) || mime.includes("pdf")) return "pdf";
  if (mime.startsWith("image/")) return "image";
  if (DOC_MIMES.has(mime) || mime.includes("word") || mime.includes("document")) return "document";
  return "other";
}

function familyLabel(family: NearDupFamily): string {
  if (family === "pdf") return "Similar PDFs";
  if (family === "document") return "Similar documents";
  if (family === "image") return "Similar images";
  return "Similar files";
}

function sortNewestFirst(files: DriveFile[]): DriveFile[] {
  return [...files].sort((a, b) => lastActivityMs(b) - lastActivityMs(a));
}

function groupBy<T>(items: T[], keyFn: (item: T) => string | null): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    if (!key) continue;
    const list = map.get(key);
    if (list) list.push(item);
    else map.set(key, [item]);
  }
  return map;
}

function uniqueFiles(files: DriveFile[]): DriveFile[] {
  const seen = new Set<string>();
  const out: DriveFile[] = [];
  for (const file of files) {
    if (!file?.id || seen.has(file.id)) continue;
    seen.add(file.id);
    out.push(file);
  }
  return out;
}

function sizeClose(a: DriveFile, b: DriveFile): boolean {
  const sa = fileBytes(a);
  const sb = fileBytes(b);
  if (!sa || !sb) return true;
  const max = Math.max(sa, sb);
  if (!max) return true;
  return Math.abs(sa - sb) / max <= 0.15;
}

function md5Key(file: DriveFile): string | null {
  const hash = file.md5Checksum?.trim().toLowerCase();
  if (!hash) return null;
  const size = file.size ?? "";
  return `${hash}:${size}`;
}

function namesDiffer(files: DriveFile[]): boolean {
  const names = new Set(files.map((f) => (f.name ?? "").trim().toLowerCase()));
  return names.size > 1;
}

function findExactDuplicates(files: DriveFile[]): {
  all: CleanupGroup[];
  renamed: CleanupGroup[];
} {
  const hashed = files.filter((f) => !isFolder(f) && !isShortcut(f) && md5Key(f));
  const buckets = groupBy(hashed, md5Key);
  const all: CleanupGroup[] = [];
  const renamed: CleanupGroup[] = [];

  let i = 0;
  for (const [key, group] of buckets) {
    if (group.length < 2) continue;
    const filesSorted = sortNewestFirst(group);
    const item: CleanupGroup = {
      id: `dup-${key}-${i++}`,
      label: filesSorted[0]?.name ?? "Duplicate set",
      reason: `${filesSorted.length} exact copies`,
      files: filesSorted,
    };
    all.push(item);
    if (namesDiffer(filesSorted)) {
      renamed.push({
        ...item,
        id: `renamed-${item.id}`,
        reason: "Same content, different names",
      });
    }
  }
  return { all, renamed };
}

function findNearDuplicates(files: DriveFile[], exactIds: Set<string>): CleanupGroup[] {
  const candidates = files.filter((f) => {
    if (isFolder(f) || isShortcut(f)) return false;
    if (exactIds.has(f.id)) return false;
    const family = mimeFamily(f);
    return family !== "other";
  });

  const buckets = groupBy(candidates, (f) => {
    const norm = normalizeCleanupName(f.name);
    if (norm.length < 4) return null;
    return `${mimeFamily(f)}:${norm.slice(0, 6)}`;
  });

  const groups: CleanupGroup[] = [];
  let i = 0;

  for (const [, bucket] of buckets) {
    if (bucket.length < 2) continue;
    const limited = bucket.length > 48 ? bucket.slice(0, 48) : bucket;
    const used = new Set<string>();

    for (let a = 0; a < limited.length; a++) {
      if (used.has(limited[a].id)) continue;
      const seed = limited[a];
      const family = mimeFamily(seed);
      const seedNorm = normalizeCleanupName(seed.name);
      const cluster: DriveFile[] = [seed];

      for (let b = a + 1; b < limited.length; b++) {
        const other = limited[b];
        if (used.has(other.id)) continue;
        if (mimeFamily(other) !== family) continue;
        if (!sizeClose(seed, other)) continue;
        const otherNorm = normalizeCleanupName(other.name);
        const similar = seedNorm === otherNorm || nameSimilarity(seedNorm, otherNorm) >= 0.82;
        if (!similar) continue;
        cluster.push(other);
      }

      if (cluster.length < 2) continue;
      for (const file of cluster) used.add(file.id);
      const sorted = sortNewestFirst(cluster);
      groups.push({
        id: `near-${family}-${i++}`,
        label: sorted[0]?.name ?? "Similar files",
        reason: `${familyLabel(family)} · likely versions of the same file`,
        family,
        files: sorted,
      });
    }
  }

  return groups;
}

function ageReason(file: DriveFile, now: number, label: string): string {
  const last = lastActivityMs(file);
  if (!last) return `${label} · no recorded activity`;
  const months = Math.max(1, Math.round((now - last) / MONTH));
  if (months >= 24) return `${label} · inactive ~${Math.round(months / 12)} years`;
  return `${label} · inactive ~${months} month${months === 1 ? "" : "s"}`;
}

function findAged(
  files: DriveFile[],
  now: number,
  minAge: number,
  label: string,
  extra?: (file: DriveFile) => boolean,
): CleanupFinding[] {
  const out: CleanupFinding[] = [];
  for (const file of files) {
    if (isFolder(file)) continue;
    if (isNewFile(file, now)) continue;
    if (extra && !extra(file)) continue;
    const last = lastActivityMs(file);
    if (last && now - last < minAge) continue;
    if (!last && minAge > 0) {
      out.push({ file, reason: ageReason(file, now, label) });
      continue;
    }
    out.push({ file, reason: ageReason(file, now, label) });
  }
  return out.sort((a, b) => lastActivityMs(a.file) - lastActivityMs(b.file));
}

function findDead(files: DriveFile[], now: number): CleanupFinding[] {
  const out: CleanupFinding[] = [];
  for (const file of files) {
    if (isFolder(file) || isShortcut(file)) continue;
    if (isNewFile(file, now)) continue;
    const viewed = parseTime(file.viewedByMeTime);
    const modified = parseTime(file.modifiedTime) || parseTime(file.createdTime);
    const last = lastActivityMs(file);
    const veryOld = last > 0 && now - last >= DEAD_AGE;
    const neverOpened = !viewed && modified > 0 && now - modified >= DEAD_NEVER_VIEWED_AGE;
    if (!veryOld && !neverOpened) continue;
    out.push({
      file,
      reason: neverOpened && !veryOld
        ? "Never opened by you · last changed over 18 months ago"
        : ageReason(file, now, "Dead file"),
    });
  }
  return out.sort((a, b) => lastActivityMs(a.file) - lastActivityMs(b.file));
}

function findUnused(
  files: DriveFile[],
  now: number,
  inboxIds: Set<string>,
): CleanupFinding[] {
  const out: CleanupFinding[] = [];
  for (const file of files) {
    if (isFolder(file) || isShortcut(file)) continue;
    if (file.starred) continue;
    if (inboxIds.has(file.id)) continue;
    if (isNewFile(file, now)) continue;
    const last = lastActivityMs(file);
    if (last && now - last < UNUSED_IDLE) continue;
    out.push({ file, reason: ageReason(file, now, "No ongoing activity") });
  }
  return out.sort((a, b) => lastActivityMs(a.file) - lastActivityMs(b.file));
}

function childrenByParent(files: DriveFile[]): Map<string, DriveFile[]> {
  const map = new Map<string, DriveFile[]>();
  for (const file of files) {
    const parents = file.parents ?? [];
    for (const parent of parents) {
      const list = map.get(parent);
      if (list) list.push(file);
      else map.set(parent, [file]);
    }
  }
  return map;
}

function findEmptyFolders(
  files: DriveFile[],
  verifiedEmptyFolderIds: Set<string>,
  truncated: boolean,
): CleanupFinding[] {
  const folders = files.filter(isFolder);
  const children = childrenByParent(files);
  const out: CleanupFinding[] = [];
  const verifiedAny = verifiedEmptyFolderIds.size > 0;

  for (const folder of folders) {
    const childCount = children.get(folder.id)?.length ?? 0;
    const verified = verifiedEmptyFolderIds.has(folder.id);
    if (verified) {
      out.push({ file: folder, reason: "Folder has no files" });
      continue;
    }
    if (childCount > 0) continue;
    if (!truncated) {
      out.push({ file: folder, reason: "Folder has no files in this scan" });
      continue;
    }
    if (!verifiedAny) {
      out.push({ file: folder, reason: "Appears empty in this scan — confirm before deleting" });
    }
  }
  return out;
}

function findBrokenShortcuts(files: DriveFile[], brokenTargetIds: Set<string>): CleanupFinding[] {
  const out: CleanupFinding[] = [];
  for (const file of files) {
    if (!isShortcut(file)) continue;
    const targetId = file.shortcutDetails?.targetId;
    if (!targetId) {
      out.push({ file, reason: "Shortcut has no target" });
      continue;
    }
    if (brokenTargetIds.has(targetId)) {
      out.push({ file, reason: "Target is deleted or inaccessible" });
    }
  }
  return out;
}

function findInaccessible(files: DriveFile[], inaccessibleIds: Set<string>): CleanupFinding[] {
  const out: CleanupFinding[] = [];
  for (const file of files) {
    if (isFolder(file) || isShortcut(file)) continue;
    if (inaccessibleIds.has(file.id)) {
      out.push({ file, reason: "Drive refused access to this file" });
      continue;
    }
    if (isGoogleNative(file)) continue;
    const caps = file.capabilities;
    if (!caps) continue;
    if (caps.canDownload === false && caps.canEdit === false) {
      out.push({ file, reason: "You can no longer download or edit this file" });
    }
  }
  return out;
}

function findOrphaned(files: DriveFile[], truncated: boolean): CleanupFinding[] {
  const folderIds = new Set(files.filter(isFolder).map((f) => f.id));
  const out: CleanupFinding[] = [];
  for (const file of files) {
    if (isFolder(file)) continue;
    const parents = file.parents ?? [];
    if (parents.length === 0) {
      out.push({ file, reason: "Not in any folder" });
      continue;
    }
    if (truncated) continue;
    const onlyRoot = parents.length === 1 && parents[0] === "root";
    if (onlyRoot) continue;
    const knownParent = parents.some((p) => p === "root" || folderIds.has(p));
    if (!knownParent) {
      out.push({ file, reason: "Parent folder is outside your current organization" });
    }
  }
  return out;
}

function findUnorganized(files: DriveFile[]): CleanupFinding[] {
  return files
    .filter((f) => !isFolder(f) && (f.parents ?? []).includes("root"))
    .map((file) => ({ file, reason: "Sitting in My Drive root" }));
}

function childNameSet(children: DriveFile[] | undefined): Set<string> {
  const names = new Set<string>();
  for (const child of children ?? []) {
    const n = (child.name ?? "").trim().toLowerCase();
    if (n) names.add(n);
  }
  return names;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

function findDuplicateFolders(files: DriveFile[]): CleanupGroup[] {
  const folders = files.filter(isFolder);
  const children = childrenByParent(files);
  const groups: CleanupGroup[] = [];
  let i = 0;

  const byName = groupBy(folders, (f) => {
    const n = normalizeCleanupName(f.name);
    return n.length >= 3 ? n : null;
  });
  for (const [, named] of byName) {
    if (named.length < 2) continue;
    groups.push({
      id: `dfolder-name-${i++}`,
      label: named[0]?.name ?? "Duplicate folders",
      reason: `${named.length} folders with the same name`,
      files: sortNewestFirst(named),
    });
  }

  const withKids = folders.filter((f) => (children.get(f.id)?.length ?? 0) >= 3);
  const cap = withKids.slice(0, 400);
  const used = new Set<string>();
  for (let a = 0; a < cap.length; a++) {
    if (used.has(cap[a].id)) continue;
    const namesA = childNameSet(children.get(cap[a].id));
    const cluster: DriveFile[] = [cap[a]];
    for (let b = a + 1; b < cap.length; b++) {
      if (used.has(cap[b].id)) continue;
      const namesB = childNameSet(children.get(cap[b].id));
      if (jaccard(namesA, namesB) >= 0.7) cluster.push(cap[b]);
    }
    if (cluster.length < 2) continue;
    for (const f of cluster) used.add(f.id);
    groups.push({
      id: `dfolder-overlap-${i++}`,
      label: cluster[0]?.name ?? "Overlapping folders",
      reason: "Folders with substantially overlapping contents",
      files: sortNewestFirst(cluster),
    });
  }

  return groups;
}

function findRedundant(
  exact: CleanupGroup[],
  near: CleanupGroup[],
): CleanupFinding[] {
  const seen = new Set<string>();
  const out: CleanupFinding[] = [];

  const consume = (groups: CleanupGroup[], reason: string) => {
    for (const group of groups) {
      const sorted = sortNewestFirst(group.files);
      const newer = sorted[0];
      for (const file of sorted.slice(1)) {
        if (seen.has(file.id)) continue;
        seen.add(file.id);
        out.push({
          file,
          reason: newer
            ? `${reason} · newer copy: ${newer.name}`
            : reason,
        });
      }
    }
  };

  consume(exact, "Older exact copy");
  consume(near, "Older similar version");
  return out.sort((a, b) => fileBytes(b.file) - fileBytes(a.file));
}

function clamp(n: number, max: number): number {
  return Math.max(0, Math.min(max, n));
}

function buildHealth(counts: CleanupCounts): CleanupHealth {
  const extraDupes = Math.max(0, counts.duplicateFiles - counts.duplicateGroups);
  const breakdown = [
    { label: "Duplicate candidates", count: counts.duplicateFiles, penalty: clamp(extraDupes * 1.4, 22) },
    { label: "Stale files (1 year)", count: counts.stale1y, penalty: clamp(counts.stale1y / 40, 18) },
    { label: "Unused files", count: counts.unused, penalty: clamp(counts.unused / 60, 12) },
    { label: "Empty folders", count: counts.emptyFolders, penalty: clamp(counts.emptyFolders * 0.8, 10) },
    { label: "Broken shortcuts", count: counts.brokenShortcuts, penalty: clamp(counts.brokenShortcuts * 3, 15) },
    { label: "Unorganized files", count: counts.unorganized, penalty: clamp(counts.unorganized / 25, 8) },
    { label: "Untagged files", count: counts.untagged, penalty: clamp(counts.untagged / 80, 10) },
    { label: "Inaccessible files", count: counts.inaccessible, penalty: clamp(counts.inaccessible * 2, 8) },
  ].map((item) => ({ ...item, penalty: Math.round(item.penalty) }));

  const penalty = breakdown.reduce((sum, item) => sum + item.penalty, 0);
  return { score: Math.max(0, Math.min(100, 100 - penalty)), breakdown };
}

function recommend(
  files: DriveFile[],
  redundant: CleanupFinding[],
  stale1y: CleanupFinding[],
  unused: CleanupFinding[],
  exact: CleanupGroup[],
  now: number,
): CleanupFinding[] {
  const redundantIds = new Set(redundant.map((f) => f.file.id));
  const staleIds = new Set(stale1y.map((f) => f.file.id));
  const unusedIds = new Set(unused.map((f) => f.file.id));
  const dupIds = new Set<string>();
  for (const group of exact) {
    for (const file of group.files) dupIds.add(file.id);
  }

  const scored = files
    .filter((f) => !isFolder(f) && !isShortcut(f) && !f.starred)
    .map((file) => {
      const bytes = fileBytes(file);
      const last = lastActivityMs(file);
      const ageYears = last ? Math.max(0.1, (now - last) / YEAR) : 2;
      const sizeScore = Math.log10(Math.max(bytes, 1_024) / 1_024);
      let score = sizeScore * (1 + ageYears);
      if (dupIds.has(file.id)) score *= 2.4;
      if (redundantIds.has(file.id)) score *= 1.6;
      if (staleIds.has(file.id)) score *= 1.25;
      if (unusedIds.has(file.id)) score *= 1.1;
      const reason = redundantIds.has(file.id)
        ? (redundant.find((f) => f.file.id === file.id)?.reason ?? "Redundant copy")
        : dupIds.has(file.id)
        ? "Duplicate — review before keeping"
        : staleIds.has(file.id)
        ? "Large stale file"
        : unusedIds.has(file.id)
        ? "Unused — safe to review"
        : "Low activity";
      return { file, reason, score };
    })
    .filter((row) => redundantIds.has(row.file.id) || dupIds.has(row.file.id) || staleIds.has(row.file.id) || unusedIds.has(row.file.id))
    .sort((a, b) => b.score - a.score)
    .slice(0, 20);

  return scored.map(({ file, reason }) => ({ file, reason }));
}

export function analyzeCleanup(files: DriveFile[], ctx: CleanupScanContext): CleanupAnalysis {
  const unique = uniqueFiles(files);
  const exact = findExactDuplicates(unique);
  const exactIds = new Set<string>();
  for (const group of exact.all) {
    for (const file of group.files) exactIds.add(file.id);
  }

  const near = findNearDuplicates(unique, exactIds);
  const dead = findDead(unique, ctx.now);
  const stale6m = findAged(unique, ctx.now, 6 * MONTH, "Stale (6 months)");
  const stale1y = findAged(unique, ctx.now, YEAR, "Stale (1 year)");
  const stale2y = findAged(unique, ctx.now, 2 * YEAR, "Stale (2 years)");
  const unused = findUnused(unique, ctx.now, ctx.inboxIds);
  const emptyFolders = findEmptyFolders(unique, ctx.verifiedEmptyFolderIds, ctx.truncated);
  const brokenShortcuts = findBrokenShortcuts(unique, ctx.brokenTargetIds);
  const inaccessible = findInaccessible(unique, ctx.inaccessibleIds);
  const orphaned = findOrphaned(unique, ctx.truncated);
  const unorganized = findUnorganized(unique);
  const duplicateFolders = findDuplicateFolders(unique);
  const redundant = findRedundant(exact.all, near);

  const untagged = unique.filter((f) => !isFolder(f) && !ctx.taggedIds.has(f.id)).length;

  const counts: CleanupCounts = {
    duplicateFiles: exact.all.reduce((n, g) => n + g.files.length, 0),
    duplicateGroups: exact.all.length,
    sameContentDifferentNames: exact.renamed.length,
    nearDuplicateFiles: near.reduce((n, g) => n + g.files.length, 0),
    nearDuplicateGroups: near.length,
    dead: dead.length,
    stale6m: stale6m.length,
    stale1y: stale1y.length,
    stale2y: stale2y.length,
    unused: unused.length,
    emptyFolders: emptyFolders.length,
    brokenShortcuts: brokenShortcuts.length,
    inaccessible: inaccessible.length,
    orphaned: orphaned.length,
    unorganized: unorganized.length,
    duplicateFolders: duplicateFolders.length,
    redundant: redundant.length,
    untagged,
  };

  return {
    duplicateGroups: exact.all,
    sameContentDifferentNames: exact.renamed,
    nearDuplicateGroups: near,
    dead,
    stale6m,
    stale1y,
    stale2y,
    unused,
    emptyFolders,
    brokenShortcuts,
    inaccessible,
    orphaned,
    unorganized,
    duplicateFolders,
    redundant,
    recommendations: recommend(unique, redundant, stale1y, unused, exact.all, ctx.now),
    counts,
    health: buildHealth(counts),
  };
}
