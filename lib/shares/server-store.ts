import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import type { PublicShareLink } from "./types";
import { effectiveStatus, isLinkAccessible } from "./status";
import { isShareToken } from "./token";

export interface StoredShareLink {
  token: string;
  manageKey: string;
  userId: string;
  fileId: string;
  fileName: string;
  mimeType: string;
  status: "active" | "revoked";
  expiresAt: string | null;
  allowDownload: boolean;
  viewCount: number;
  downloadCount: number;
  revokedAt: string | null;
}

type StoreFile = { links: Record<string, StoredShareLink> };

const globalKey = "__drive_share_link_store__";

type GlobalStore = {
  links: Map<string, StoredShareLink>;
  loaded: boolean;
  lastView: Map<string, number>;
};

function bucket(): GlobalStore {
  const g = globalThis as typeof globalThis & { [globalKey]?: GlobalStore };
  if (!g[globalKey]) {
    g[globalKey] = { links: new Map(), loaded: false, lastView: new Map() };
  }
  return g[globalKey]!;
}

function filePath(): string {
  return path.join(process.cwd(), ".data", "share-links.json");
}

async function load(): Promise<Map<string, StoredShareLink>> {
  const store = bucket();
  if (store.loaded) return store.links;
  try {
    const raw = await readFile(filePath(), "utf8");
    const parsed = JSON.parse(raw) as StoreFile;
    const links = parsed?.links && typeof parsed.links === "object" ? parsed.links : {};
    store.links = new Map(Object.entries(links).filter(([token]) => isShareToken(token)));
  } catch {
    store.links = new Map();
  }
  store.loaded = true;
  return store.links;
}

async function persist(): Promise<void> {
  const store = bucket();
  try {
    await mkdir(path.dirname(filePath()), { recursive: true });
    const links: Record<string, StoredShareLink> = {};
    for (const [token, row] of store.links) links[token] = row;
    await writeFile(filePath(), JSON.stringify({ links }, null, 0), "utf8");
  } catch {
    /* read-only host — in-memory still works for this process */
  }
}

function clampCount(n: unknown): number {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v) || v < 0) return 0;
  return Math.min(1_000_000_000, Math.floor(v));
}

export function toPublic(row: StoredShareLink): PublicShareLink {
  const asLink = {
    status: row.status,
    expiresAt: row.expiresAt,
  };
  return {
    token: row.token,
    fileId: row.fileId,
    fileName: row.fileName,
    mimeType: row.mimeType,
    status: effectiveStatus(asLink),
    expiresAt: row.expiresAt,
    allowDownload: row.allowDownload,
    viewCount: row.viewCount,
    downloadCount: row.downloadCount,
  };
}

export async function getStored(token: string): Promise<StoredShareLink | null> {
  if (!isShareToken(token)) return null;
  const links = await load();
  return links.get(token) ?? null;
}

export async function upsertStored(token: string, incoming: StoredShareLink): Promise<StoredShareLink> {
  const links = await load();
  const existing = links.get(token);
  if (existing && existing.manageKey !== incoming.manageKey) {
    throw new Error("Forbidden");
  }
  const next: StoredShareLink = {
    ...incoming,
    token,
    viewCount: Math.max(existing?.viewCount ?? 0, clampCount(incoming.viewCount)),
    downloadCount: Math.max(existing?.downloadCount ?? 0, clampCount(incoming.downloadCount)),
  };
  links.set(token, next);
  await persist();
  return next;
}

export async function patchStored(
  token: string,
  manageKey: string,
  patch: { status?: "active" | "revoked"; expiresAt?: string | null; delete?: boolean },
): Promise<boolean> {
  const links = await load();
  const existing = links.get(token);
  if (!existing || existing.manageKey !== manageKey) return false;
  if (patch.delete) {
    links.delete(token);
    await persist();
    return true;
  }
  const next: StoredShareLink = {
    ...existing,
    status: patch.status ?? existing.status,
    expiresAt: patch.expiresAt !== undefined ? patch.expiresAt : existing.expiresAt,
    revokedAt: patch.status === "revoked" ? new Date().toISOString() : existing.revokedAt,
  };
  links.set(token, next);
  await persist();
  return true;
}

export async function hitStored(
  token: string,
  kind: "view" | "download",
): Promise<StoredShareLink | null> {
  const links = await load();
  const existing = links.get(token);
  if (!existing) return null;
  if (!isLinkAccessible(existing)) return existing;
  if (kind === "download" && !existing.allowDownload) return existing;

  if (kind === "view") {
    const last = bucket().lastView.get(token) ?? 0;
    if (Date.now() - last < 2000) return existing;
    bucket().lastView.set(token, Date.now());
  }

  const next: StoredShareLink = {
    ...existing,
    viewCount: kind === "view" ? existing.viewCount + 1 : existing.viewCount,
    downloadCount: kind === "download" ? existing.downloadCount + 1 : existing.downloadCount,
  };
  links.set(token, next);
  await persist();
  return next;
}

export async function statsFor(tokens: string[]): Promise<Record<string, { viewCount: number; downloadCount: number }>> {
  const links = await load();
  const out: Record<string, { viewCount: number; downloadCount: number }> = {};
  for (const token of tokens) {
    if (!isShareToken(token)) continue;
    const row = links.get(token);
    if (!row) continue;
    out[token] = { viewCount: row.viewCount, downloadCount: row.downloadCount };
  }
  return out;
}
