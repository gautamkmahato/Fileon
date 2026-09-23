import type { ShareLink, ShareLinkCounts } from "./types";
import { isShareToken } from "./token";

export interface ServerSharePayload {
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

async function readJson<T>(res: Response): Promise<T | null> {
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function publishShareLink(link: ShareLink): Promise<boolean> {
  try {
    const res = await fetch(`/api/share-links/${encodeURIComponent(link.token)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        manageKey: link.manageKey,
        userId: link.userId,
        fileId: link.fileId,
        fileName: link.fileName,
        mimeType: link.mimeType,
        status: link.status,
        expiresAt: link.expiresAt,
        allowDownload: link.allowDownload,
        viewCount: link.viewCount,
        downloadCount: link.downloadCount,
        revokedAt: link.revokedAt,
      } satisfies ServerSharePayload),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function fetchPublicShareLink(token: string) {
  if (!isShareToken(token)) return null;
  try {
    const res = await fetch(`/api/share-links/${encodeURIComponent(token)}`);
    if (!res.ok) return null;
    return readJson<import("./types").PublicShareLink>(res);
  } catch {
    return null;
  }
}

export async function postShareHit(token: string, kind: "view" | "download"): Promise<ShareLinkCounts | null> {
  if (!isShareToken(token)) return null;
  try {
    const res = await fetch(`/api/share-links/${encodeURIComponent(token)}/hit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind }),
    });
    if (!res.ok) return null;
    return readJson<ShareLinkCounts>(res);
  } catch {
    return null;
  }
}

export async function manageShareLink(
  token: string,
  manageKey: string,
  patch: { status?: "active" | "revoked"; expiresAt?: string | null; delete?: boolean },
): Promise<boolean> {
  if (!isShareToken(token) || !isShareToken(manageKey)) return false;
  try {
    const res = await fetch(`/api/share-links/${encodeURIComponent(token)}/manage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ manageKey, ...patch }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function fetchShareLinkStats(tokens: string[]): Promise<Map<string, ShareLinkCounts>> {
  const valid = tokens.filter(isShareToken).slice(0, 200);
  const map = new Map<string, ShareLinkCounts>();
  if (valid.length === 0) return map;
  try {
    const res = await fetch("/api/share-links/stats", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tokens: valid }),
    });
    if (!res.ok) return map;
    const body = await readJson<{ counts?: Record<string, ShareLinkCounts> }>(res);
    for (const [token, counts] of Object.entries(body?.counts ?? {})) {
      if (!isShareToken(token) || !counts) continue;
      map.set(token, {
        viewCount: Math.max(0, Math.floor(Number(counts.viewCount) || 0)),
        downloadCount: Math.max(0, Math.floor(Number(counts.downloadCount) || 0)),
      });
    }
  } catch {
    /* owner IndexedDB still has local counts */
  }
  return map;
}
