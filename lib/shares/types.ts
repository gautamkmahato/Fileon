import type { ShareLinkRow, ShareLinkStatus } from "@/lib/db/schema";

export type ShareLinkEffectiveStatus = "active" | "expired" | "revoked";

export interface ShareLink {
  id: string;
  userId: string;
  token: string;
  manageKey: string;
  fileId: string;
  fileName: string;
  mimeType: string;
  status: ShareLinkStatus;
  expiresAt: string | null;
  allowDownload: boolean;
  viewCount: number;
  downloadCount: number;
  createdAt: string;
  updatedAt: string;
  revokedAt: string | null;
}

export interface ShareLinkDraft {
  fileId: string;
  fileName: string;
  mimeType: string;
  expiresAt?: string | null;
  allowDownload?: boolean;
}

export interface PublicShareLink {
  token: string;
  fileId: string;
  fileName: string;
  mimeType: string;
  status: ShareLinkEffectiveStatus;
  expiresAt: string | null;
  allowDownload: boolean;
  viewCount: number;
  downloadCount: number;
}

export interface ShareLinkCounts {
  viewCount: number;
  downloadCount: number;
}

export function rowToShareLink(row: ShareLinkRow): ShareLink {
  return {
    id: row.id,
    userId: row.user_id,
    token: row.token,
    manageKey: row.manage_key,
    fileId: row.file_id,
    fileName: row.file_name,
    mimeType: row.mime_type,
    status: row.status,
    expiresAt: row.expires_at,
    allowDownload: row.allow_download,
    viewCount: row.view_count,
    downloadCount: row.download_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    revokedAt: row.revoked_at,
  };
}

export function shareLinkToRow(link: ShareLink): ShareLinkRow {
  return {
    id: link.id,
    user_id: link.userId,
    token: link.token,
    manage_key: link.manageKey,
    file_id: link.fileId,
    file_name: link.fileName,
    mime_type: link.mimeType,
    status: link.status,
    expires_at: link.expiresAt,
    allow_download: link.allowDownload,
    view_count: link.viewCount,
    download_count: link.downloadCount,
    created_at: link.createdAt,
    updated_at: link.updatedAt,
    revoked_at: link.revokedAt,
  };
}
