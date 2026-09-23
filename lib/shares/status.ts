import type { ShareLink, ShareLinkEffectiveStatus, PublicShareLink } from "./types";

export function effectiveStatus(
  link: Pick<ShareLink, "status" | "expiresAt">,
  now = Date.now(),
): ShareLinkEffectiveStatus {
  if (link.status === "revoked") return "revoked";
  if (link.expiresAt) {
    const t = Date.parse(link.expiresAt);
    if (Number.isFinite(t) && t <= now) return "expired";
  }
  return "active";
}

export function isLinkAccessible(link: Pick<ShareLink, "status" | "expiresAt">, now = Date.now()): boolean {
  return effectiveStatus(link, now) === "active";
}

export function toPublicShareLink(link: ShareLink, now = Date.now()): PublicShareLink {
  return {
    token: link.token,
    fileId: link.fileId,
    fileName: link.fileName,
    mimeType: link.mimeType,
    status: effectiveStatus(link, now),
    expiresAt: link.expiresAt,
    allowDownload: link.allowDownload,
    viewCount: link.viewCount,
    downloadCount: link.downloadCount,
  };
}

export function formatExpiry(iso: string | null | undefined): string {
  if (!iso) return "Never";
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "Never";
  const date = new Date(t);
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

export function formatCount(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "0";
  return String(Math.floor(n));
}

export const EXPIRY_PRESETS = [
  { id: "7d", label: "7 days", days: 7 },
  { id: "30d", label: "30 days", days: 30 },
  { id: "90d", label: "90 days", days: 90 },
  { id: "never", label: "Never", days: null },
] as const;

export type ExpiryPresetId = (typeof EXPIRY_PRESETS)[number]["id"];

export function expiryFromPreset(id: ExpiryPresetId, now = Date.now()): string | null {
  const preset = EXPIRY_PRESETS.find((p) => p.id === id);
  if (!preset || preset.days == null) return null;
  return new Date(now + preset.days * 24 * 60 * 60 * 1000).toISOString();
}
