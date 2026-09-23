/**
 * Extra Drive helpers — move and folder listing.
 * Add these to your existing drive.ts, OR keep them as a separate file and
 * import from "@/lib/drive/drive-extras".
 */

import { addPermission, listPermissions, removePermission, type DrivePermission } from "@/lib/drive/drive-permissions";
import type { DriveFile } from "./drive";
import { DRIVE_FILE_FIELDS } from "./drive";

const API = "https://www.googleapis.com/drive/v3";

/**
 * Move a file by replacing its parents. The Drive API requires us to pass
 * BOTH addParents and removeParents in a single PATCH request — using a
 * separate call would briefly leave the file in two places.
 */
export async function moveFile(opts: {
  token: string;
  fileId: string;
  newParentId: string;
  oldParentId: string;
}): Promise<void> {
  const { token, fileId, newParentId, oldParentId } = opts;
  const params = new URLSearchParams({
    addParents: newParentId,
    removeParents: oldParentId,
    fields: "id,parents",
  });
  const res = await fetch(`${API}/files/${fileId}?${params}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Move failed (${res.status}): ${await res.text()}`);
}

/** Copy a file into a folder (Drive files.copy). */
export async function copyFile(opts: {
  token: string;
  fileId: string;
  newParentId: string;
}): Promise<DriveFile> {
  const { token, fileId, newParentId } = opts;
  const params = new URLSearchParams({ fields: DRIVE_FILE_FIELDS });
  const res = await fetch(`${API}/files/${fileId}/copy?${params}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      parents: [newParentId === "root" ? "root" : newParentId],
    }),
  });
  if (!res.ok) throw new Error(`Copy failed (${res.status}): ${await res.text()}`);
  return res.json();
}

/**
 * Fetch every non-trashed folder the user owns (with id, name, parents).
 * Used by the "Move to…" picker. Paginated to handle large drives.
 */
export interface DriveFolder {
  id: string;
  name: string;
  parents?: string[];
}

export async function listAllFolders(token: string): Promise<DriveFolder[]> {
  const folders: DriveFolder[] = [];
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({
      q: "mimeType = 'application/vnd.google-apps.folder' and trashed = false",
      fields: "nextPageToken,files(id,name,parents)",
      pageSize: "200",
      ...(pageToken ? { pageToken } : {}),
    });
    const res = await fetch(`${API}/files?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`List folders failed (${res.status})`);
    const data = await res.json();
    folders.push(...(data.files || []));
    pageToken = data.nextPageToken;
  } while (pageToken);
  return folders;
}

/**
 * Find the existing "anyone with link, reader" permission on a file, if any.
 * Returns null if there isn't one.
 */
export async function findLinkPermission(token: string, fileId: string): Promise<DrivePermission | null> {
  const perms = await listPermissions(token, fileId);
  return perms.find((p) => p.type === "anyone") || null;
}

/** Enable "anyone with the link can view" sharing on a file. */
export async function enableLinkShare(token: string, fileId: string): Promise<DrivePermission> {
  return addPermission({
    token,
    fileId,
    role: "reader",
    type: "anyone",
    sendNotificationEmail: false,
  });
}

/** Disable link sharing by removing the "anyone" permission. */
export async function disableLinkShare(token: string, fileId: string, permissionId: string): Promise<void> {
  return removePermission(token, fileId, permissionId);
}

/** Construct the public share URL for a Drive file. */
export function buildShareUrl(fileId: string, mimeType: string): string {
  // Google's preview URLs vary slightly by file type. The /view URL works for
  // everything and respects whether the file has anyone-link sharing enabled.
  if (mimeType.startsWith("application/vnd.google-apps.")) {
    const kind = mimeType.includes("document") ? "document"
              : mimeType.includes("spreadsheet") ? "spreadsheets"
              : mimeType.includes("presentation") ? "presentation"
              : mimeType.includes("drawing") ? "drawings"
              : mimeType.includes("form") ? "forms"
              : "file";
    if (kind === "file") return `https://drive.google.com/file/d/${fileId}/view`;
    return `https://docs.google.com/${kind}/d/${fileId}/view`;
  }
  return `https://drive.google.com/file/d/${fileId}/view`;
}

/** Direct download URL. Google Docs types fall back to the view URL. */
export function buildDriveDownloadUrl(fileId: string, mimeType: string): string {
  if (mimeType.startsWith("application/vnd.google-apps.")) {
    return buildShareUrl(fileId, mimeType);
  }
  return `https://drive.google.com/uc?export=download&id=${encodeURIComponent(fileId)}`;
}