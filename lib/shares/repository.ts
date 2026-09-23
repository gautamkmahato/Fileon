import {
  MAX_SHARE_LINKS,
  MAX_SHARE_LINKS_PER_FILE,
  SHARE_LINK_STATUSES,
  type ShareLinkRow,
  type ShareLinkStatus,
} from "@/lib/db/schema";
import { pgDelete, pgGet, pgGetByIndex, pgSelectByUser, pgUpsert } from "@/lib/db/engine";
import {
  assertUserId, newId, nowIso, parseIso, sanitizeFileId, sanitizeName, sanitizeText,
} from "@/lib/db/sanitize";
import { isLinkAccessible } from "./status";
import { isShareToken, newShareSecret } from "./token";
import { fetchShareLinkStats, manageShareLink, publishShareLink } from "./publish";
import { rowToShareLink, shareLinkToRow, type ShareLink, type ShareLinkDraft } from "./types";

type Listener = () => void;
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach((fn) => fn());
}

export function subscribeShareLinks(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function clampCount(n: unknown): number {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v) || v < 0) return 0;
  return Math.min(1_000_000_000, Math.floor(v));
}

function sanitizeStatus(value: string | null | undefined): ShareLinkStatus {
  return SHARE_LINK_STATUSES.includes(value as ShareLinkStatus) ? (value as ShareLinkStatus) : "active";
}

function sanitizeExpiry(value: string | null | undefined): string | null {
  if (!value) return null;
  const iso = parseIso(value);
  return iso;
}

async function writeLink(link: ShareLink): Promise<ShareLink> {
  await pgUpsert("share_links", shareLinkToRow(link));
  void publishShareLink(link);
  notify();
  return link;
}

export async function listShareLinks(userId: string): Promise<ShareLink[]> {
  const uid = assertUserId(userId);
  const rows = await pgSelectByUser("share_links", uid);
  return rows
    .map(rowToShareLink)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function listShareLinksForFile(userId: string, fileId: string): Promise<ShareLink[]> {
  const fid = sanitizeFileId(fileId);
  if (!fid) return [];
  const all = await listShareLinks(userId);
  return all.filter((l) => l.fileId === fid);
}

export async function getShareLink(userId: string, id: string): Promise<ShareLink | null> {
  const uid = assertUserId(userId);
  const row = await pgGet("share_links", id);
  if (!row || row.user_id !== uid) return null;
  return rowToShareLink(row);
}

export async function getShareLinkByToken(token: string): Promise<ShareLink | null> {
  if (!isShareToken(token)) return null;
  const row = await pgGetByIndex("share_links", "token", token);
  return row ? rowToShareLink(row) : null;
}

export async function createShareLink(userId: string, draft: ShareLinkDraft): Promise<ShareLink> {
  const uid = assertUserId(userId);
  const fileId = sanitizeFileId(draft.fileId);
  if (!fileId) throw new Error("Invalid file");

  const existing = await listShareLinks(uid);
  if (existing.length >= MAX_SHARE_LINKS) {
    throw new Error(`You can have at most ${MAX_SHARE_LINKS} share links`);
  }
  const forFile = existing.filter((l) => l.fileId === fileId && l.status === "active");
  if (forFile.length >= MAX_SHARE_LINKS_PER_FILE) {
    throw new Error(`This file already has ${MAX_SHARE_LINKS_PER_FILE} active links`);
  }

  const now = nowIso();
  const link: ShareLink = {
    id: newId(),
    userId: uid,
    token: newShareSecret(),
    manageKey: newShareSecret(),
    fileId,
    fileName: sanitizeName(draft.fileName),
    mimeType: sanitizeText(draft.mimeType, 256) || "application/octet-stream",
    status: "active",
    expiresAt: sanitizeExpiry(draft.expiresAt ?? null),
    allowDownload: draft.allowDownload !== false,
    viewCount: 0,
    downloadCount: 0,
    createdAt: now,
    updatedAt: now,
    revokedAt: null,
  };
  return writeLink(link);
}

export async function revokeShareLink(userId: string, id: string): Promise<ShareLink | null> {
  const current = await getShareLink(userId, id);
  if (!current) return null;
  if (current.status === "revoked") return current;
  const now = nowIso();
  const next: ShareLink = {
    ...current,
    status: "revoked",
    revokedAt: now,
    updatedAt: now,
  };
  await writeLink(next);
  void manageShareLink(next.token, next.manageKey, { status: "revoked" });
  return next;
}

export async function updateShareLinkExpiry(
  userId: string,
  id: string,
  expiresAt: string | null,
): Promise<ShareLink | null> {
  const current = await getShareLink(userId, id);
  if (!current) return null;
  if (current.status === "revoked") return current;
  const next: ShareLink = {
    ...current,
    expiresAt: sanitizeExpiry(expiresAt),
    updatedAt: nowIso(),
  };
  await writeLink(next);
  void manageShareLink(next.token, next.manageKey, { expiresAt: next.expiresAt });
  return next;
}

export async function deleteShareLink(userId: string, id: string): Promise<boolean> {
  const current = await getShareLink(userId, id);
  if (!current) return false;
  await pgDelete("share_links", id);
  void manageShareLink(current.token, current.manageKey, { delete: true });
  notify();
  return true;
}

export async function recordShareHit(
  token: string,
  kind: "view" | "download",
): Promise<ShareLink | null> {
  const current = await getShareLinkByToken(token);
  if (!current) return null;
  if (!isLinkAccessible(current)) return current;
  if (kind === "download" && !current.allowDownload) return current;

  const next: ShareLink = {
    ...current,
    viewCount: kind === "view" ? current.viewCount + 1 : current.viewCount,
    downloadCount: kind === "download" ? current.downloadCount + 1 : current.downloadCount,
    updatedAt: nowIso(),
  };
  await pgUpsert("share_links", shareLinkToRow(next));
  notify();
  return next;
}

export async function mergeShareLinkCounts(userId: string): Promise<ShareLink[]> {
  const uid = assertUserId(userId);
  const links = await listShareLinks(uid);
  if (links.length === 0) return links;
  const remote = await fetchShareLinkStats(links.map((l) => l.token));
  if (remote.size === 0) return links;

  const out: ShareLink[] = [];
  for (const link of links) {
    const counts = remote.get(link.token);
    if (!counts) {
      out.push(link);
      continue;
    }
    const viewCount = Math.max(link.viewCount, counts.viewCount);
    const downloadCount = Math.max(link.downloadCount, counts.downloadCount);
    if (viewCount === link.viewCount && downloadCount === link.downloadCount) {
      out.push(link);
      continue;
    }
    const next: ShareLink = { ...link, viewCount, downloadCount, updatedAt: nowIso() };
    await pgUpsert("share_links", shareLinkToRow(next));
    out.push(next);
  }
  return out;
}
