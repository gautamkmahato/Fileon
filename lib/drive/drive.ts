/**
 * Thin wrapper around the Google Drive v3 REST API.
 * Stateless — pass the access token in to every call.
 *
 * Docs: https://developers.google.com/drive/api/v3/reference
 */

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  iconLink?: string;
  thumbnailLink?: string;
  webViewLink?: string;
  webContentLink?: string;
  modifiedTime?: string;
  createdTime?: string;
  size?: string;
  owners?: Array<{ displayName: string; emailAddress: string; photoLink?: string }>;
  shared?: boolean;
  starred?: boolean;
  trashed?: boolean;
  parents?: string[];
  capabilities?: { canEdit?: boolean; canDownload?: boolean; canDelete?: boolean };
  md5Checksum?: string;
  viewedByMeTime?: string;
  shortcutDetails?: { targetId?: string; targetMimeType?: string };
}

export interface DriveListResponse {
  files: DriveFile[];
  nextPageToken?: string;
}

const API = "https://www.googleapis.com/drive/v3";
const UPLOAD_API = "https://www.googleapis.com/upload/drive/v3";

// Reasonable default `fields` mask — keeps responses small but covers UI needs.
const DEFAULT_FILE_FIELDS = [
  "id",
  "name",
  "mimeType",
  "iconLink",
  "thumbnailLink",
  "webViewLink",
  "webContentLink",
  "modifiedTime",
  "createdTime",
  "size",
  "owners(displayName,emailAddress,photoLink)",
  "shared",
  "starred",
  "trashed",
  "parents",
  "capabilities(canEdit,canDownload,canDelete)",
].join(",");

export const DRIVE_FILE_FIELDS = DEFAULT_FILE_FIELDS;

/** Extra fields for cleanup scans — not used on normal folder lists. */
export const CLEANUP_FILE_FIELDS = [
  DEFAULT_FILE_FIELDS,
  "md5Checksum",
  "viewedByMeTime",
  "shortcutDetails(targetId,targetMimeType)",
].join(",");

let tokenRefreshFn: (() => Promise<string | null>) | null = null;

/** Register a silent token refresh — called from AuthProvider. */
export function setDriveTokenRefresh(fn: (() => Promise<string | null>) | null) {
  tokenRefreshFn = fn;
}

async function driveFetch(
  url: string,
  token: string,
  init: RequestInit = {},
  retried = false,
): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(init.headers || {}),
      },
    });
  } catch (err) {
    if (!retried) {
      return driveFetch(url, token, init, true);
    }
    const msg = err instanceof Error ? err.message : "Network request failed";
    throw new DriveApiError(0, msg);
  }

  if (res.status === 401 && !retried && tokenRefreshFn) {
    const fresh = await tokenRefreshFn();
    if (fresh) return driveFetch(url, fresh, init, true);
  }

  if (!res.ok) {
    const text = await res.text();
    throw new DriveApiError(res.status, text || res.statusText);
  }
  return res;
}

export class DriveApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(`Drive API ${status}: ${message}`);
    this.status = status;
  }
}

/** List files in a folder (or root if folderId is null). */
export async function listFiles(opts: {
  token: string;
  folderId?: string | null;
  pageToken?: string;
  pageSize?: number;
  query?: string;
  orderBy?: string;
}): Promise<DriveListResponse> {
  const { token, folderId, pageToken, pageSize = 50, query, orderBy = "folder,modifiedTime desc" } = opts;

  const qParts: string[] = ["trashed=false"];
  if (folderId) qParts.push(`'${folderId}' in parents`);
  else qParts.push(`'root' in parents`);
  if (query) {
    // User-typed query: search name. (Drive's query syntax requires escaping single quotes.)
    const safe = query.replace(/'/g, "\\'");
    qParts.push(`name contains '${safe}'`);
  }

  const params = new URLSearchParams({
    q: qParts.join(" and "),
    pageSize: String(pageSize),
    fields: `nextPageToken, files(${DEFAULT_FILE_FIELDS})`,
    orderBy,
    spaces: "drive",
  });
  if (pageToken) params.set("pageToken", pageToken);

  const res = await driveFetch(`${API}/files?${params}`, token);
  return res.json();
}

/** Search across ALL the user's accessible files (no folder constraint). */
export async function searchFiles(opts: {
  token: string;
  query: string;
  pageSize?: number;
  pageToken?: string;
}): Promise<DriveListResponse> {
  const { token, query, pageSize = 50, pageToken } = opts;
  const safe = query.replace(/'/g, "\\'");
  const params = new URLSearchParams({
    q: `name contains '${safe}' and trashed=false`,
    pageSize: String(pageSize),
    fields: `nextPageToken, files(${DEFAULT_FILE_FIELDS})`,
    orderBy: "modifiedTime desc",
    spaces: "drive",
  });
  if (pageToken) params.set("pageToken", pageToken);
  const res = await driveFetch(`${API}/files?${params}`, token);
  return res.json();
}

/** Get a single file's full metadata. */
export async function getFile(token: string, fileId: string): Promise<DriveFile> {
  const params = new URLSearchParams({ fields: DEFAULT_FILE_FIELDS });
  const res = await driveFetch(`${API}/files/${fileId}?${params}`, token);
  return res.json();
}

/**
 * Resolve a Drive thumbnail URL into a blob URL the browser can render.
 * Drive's thumbnailLink requires the Authorization header — embedding it
 * in an <img> tag directly fails because <img> doesn't send auth headers.
 *
 * We fetch with auth, then create an object URL. Caller should revoke it
 * when no longer needed (URL.revokeObjectURL).
 */
export async function fetchThumbnailAsBlobUrl(
  token: string,
  thumbnailLink: string
): Promise<string> {
  // Drive's thumbnailLink sometimes includes a size suffix (=s220). We can
  // request larger by replacing it; here we just use what was returned.
  const res = await fetch(thumbnailLink, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new DriveApiError(res.status, "thumbnail fetch failed");
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

/** Download file content. For Google Docs/Sheets/Slides, use exportFile instead. */
export async function downloadFile(token: string, fileId: string): Promise<Blob> {
  const res = await driveFetch(`${API}/files/${fileId}?alt=media`, token);
  return res.blob();
}

/**
 * Export a Google-native doc (Docs/Sheets/Slides) as another format.
 * mimeType examples:
 *   - application/pdf
 *   - application/vnd.openxmlformats-officedocument.wordprocessingml.document  (docx)
 *   - application/vnd.openxmlformats-officedocument.spreadsheetml.sheet        (xlsx)
 *   - text/html, text/plain, image/png (for slides)
 */
export async function exportFile(token: string, fileId: string, mimeType: string): Promise<Blob> {
  const params = new URLSearchParams({ mimeType });
  const res = await driveFetch(`${API}/files/${fileId}/export?${params}`, token);
  return res.blob();
}

/** Create a folder. */
export async function createFolder(
  token: string,
  name: string,
  parentId?: string | null
): Promise<DriveFile> {
  const body = {
    name,
    mimeType: "application/vnd.google-apps.folder",
    parents: parentId ? [parentId] : undefined,
  };
  const res = await driveFetch(`${API}/files?fields=${DEFAULT_FILE_FIELDS}`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

/** Rename a file. */
export async function renameFile(token: string, fileId: string, newName: string): Promise<DriveFile> {
  const res = await driveFetch(`${API}/files/${fileId}?fields=${DEFAULT_FILE_FIELDS}`, token, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: newName }),
  });
  return res.json();
}

/** Star / unstar a file. */
export async function setStarred(token: string, fileId: string, starred: boolean): Promise<DriveFile> {
  const res = await driveFetch(`${API}/files/${fileId}?fields=${DEFAULT_FILE_FIELDS}`, token, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ starred }),
  });
  return res.json();
}

/** Trash a file (move to trash, not permanent delete). */
export async function trashFile(token: string, fileId: string): Promise<void> {
  await driveFetch(`${API}/files/${fileId}`, token, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ trashed: true }),
  });
}

/** Restore a file from trash. */
export async function restoreFile(token: string, fileId: string): Promise<DriveFile> {
  const res = await driveFetch(`${API}/files/${fileId}?fields=${DEFAULT_FILE_FIELDS}`, token, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ trashed: false }),
  });
  return res.json();
}

/** Alias for restoreFile. */
export const untrashFile = restoreFile;

/** Permanently delete a file (no recovery). */
export async function deleteForever(token: string, fileId: string): Promise<void> {
  await driveFetch(`${API}/files/${fileId}`, token, { method: "DELETE" });
}

/** Empty the trash — permanently deletes all trashed files. */
export async function emptyTrash(token: string): Promise<void> {
  await driveFetch(`${API}/files/trash`, token, { method: "DELETE" });
}

/** List files matching an arbitrary Drive query. */
export async function listFilesByQuery(opts: {
  token: string;
  q: string;
  pageToken?: string;
  pageSize?: number;
  orderBy?: string;
  fileFields?: string;
}): Promise<DriveListResponse> {
  const { token, q, pageToken, pageSize = 50, orderBy = "modifiedTime desc", fileFields } = opts;
  const params = new URLSearchParams({
    q,
    pageSize: String(pageSize),
    fields: `nextPageToken, files(${fileFields ?? DEFAULT_FILE_FIELDS})`,
    orderBy,
    spaces: "drive",
  });
  if (pageToken) params.set("pageToken", pageToken);
  const res = await driveFetch(`${API}/files?${params}`, token);
  return res.json();
}

/** Fetch metadata for specific file IDs (uses files.get — id is not valid in list q). */
export async function getFilesByIds(
  token: string,
  fileIds: string[]
): Promise<DriveListResponse> {
  if (!fileIds.length) return { files: [] };
  const results = await Promise.allSettled(
    fileIds.map((id) => getFile(token, id))
  );
  const files = results
    .filter((r): r is PromiseFulfilledResult<DriveFile> => r.status === "fulfilled")
    .map((r) => r.value);
  return { files };
}

/** Fetch all files for a set of IDs (parallel files.get, skips missing/deleted). */
export async function fetchAllFilesByIds(token: string, fileIds: string[]): Promise<DriveFile[]> {
  if (!fileIds.length) return [];
  const CHUNK = 20;
  const files: DriveFile[] = [];
  for (let i = 0; i < fileIds.length; i += CHUNK) {
    const chunk = fileIds.slice(i, i + CHUNK);
    const res = await getFilesByIds(token, chunk);
    files.push(...res.files);
  }
  const byId = new Map(files.map((f) => [f.id, f]));
  return fileIds.map((id) => byId.get(id)).filter((f): f is DriveFile => !!f);
}

export function listStarredFiles(token: string, pageToken?: string) {
  return listFilesByQuery({
    token,
    q: "starred = true and trashed = false",
    pageToken,
    orderBy: "modifiedTime desc",
  });
}

export function listRecentFiles(token: string, pageToken?: string) {
  return listFilesByQuery({
    token,
    q: "trashed = false",
    pageToken,
    pageSize: 50,
    orderBy: "viewedByMeTime desc,modifiedTime desc",
  });
}

export function listTrashFiles(token: string, pageToken?: string) {
  return listFilesByQuery({
    token,
    q: "trashed = true",
    pageToken,
    orderBy: "modifiedTime desc",
  });
}

export interface StorageQuota {
  limit?: string;
  usage?: string;
  usageInDrive?: string;
}

export async function getStorageQuota(token: string): Promise<StorageQuota> {
  const res = await driveFetch(`${API}/about?fields=storageQuota`, token);
  const data = await res.json();
  return data.storageQuota || {};
}

/** List top-level folders (direct children of root). */
export async function listRootFolders(token: string): Promise<DriveFile[]> {
  const res = await listFilesByQuery({
    token,
    q: "mimeType = 'application/vnd.google-apps.folder' and trashed = false and 'root' in parents",
    orderBy: "name",
    pageSize: 100,
  });
  return res.files;
}

/** List folders inside a parent folder. */
export async function listChildFolders(token: string, parentId: string): Promise<DriveFile[]> {
  const res = await listFilesByQuery({
    token,
    q: `mimeType = 'application/vnd.google-apps.folder' and trashed = false and '${parentId}' in parents`,
    orderBy: "name",
    pageSize: 100,
  });
  return res.files;
}

/** Upload a file (multipart). */
export async function uploadFile(opts: {
  token: string;
  file: File;
  parentId?: string | null;
}): Promise<DriveFile> {
  const { token, file, parentId } = opts;
  const metadata = {
    name: file.name,
    parents: parentId ? [parentId] : undefined,
  };
  const form = new FormData();
  form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
  form.append("file", file);

  const res = await fetch(`${UPLOAD_API}/files?uploadType=multipart&fields=${DEFAULT_FILE_FIELDS}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!res.ok) throw new DriveApiError(res.status, await res.text());
  return res.json();
}

/** Fetch the user's profile info (name, email, picture). Uses the OpenID UserInfo endpoint. */
export interface UserProfile {
  sub: string;
  name: string;
  given_name?: string;
  picture?: string;
  email: string;
}

export async function fetchUserProfile(token: string): Promise<UserProfile> {
  const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new DriveApiError(res.status, "userinfo fetch failed");
  return res.json();
}

// ── MIME type helpers ──────────────────────────────────────────────────────

export const FOLDER_MIME = "application/vnd.google-apps.folder";
export const SHORTCUT_MIME = "application/vnd.google-apps.shortcut";

export function isFolder(file: { mimeType: string }): boolean {
  return file.mimeType === FOLDER_MIME;
}

export function isShortcut(file: { mimeType: string }): boolean {
  return file.mimeType === SHORTCUT_MIME;
}

/** Probe whether a file still exists and is reachable. Never throws on 404/403. */
export async function probeFileAccess(
  token: string,
  fileId: string,
): Promise<"ok" | "missing" | "forbidden" | "unknown"> {
  if (!fileId) return "unknown";
  try {
    const params = new URLSearchParams({ fields: "id,trashed" });
    const res = await driveFetch(`${API}/files/${fileId}?${params}`, token);
    const data = (await res.json()) as { id?: string; trashed?: boolean };
    if (data.trashed) return "missing";
    return "ok";
  } catch (err) {
    if (err instanceof DriveApiError) {
      if (err.status === 404) return "missing";
      if (err.status === 403) return "forbidden";
      if (err.status === 401) throw err;
    }
    return "unknown";
  }
}

export function isImageMime(mimeType: string): boolean {
  return mimeType.startsWith("image/");
}

export async function listFolderImages(
  token: string,
  folderId: string,
  pageToken?: string,
): Promise<DriveListResponse> {
  return listFilesByQuery({
    token,
    q: `'${folderId}' in parents and trashed = false and mimeType contains 'image/'`,
    pageToken,
    pageSize: 100,
    orderBy: "modifiedTime desc",
  });
}

export function isGoogleNative(file: { mimeType: string }): boolean {
  return file.mimeType.startsWith("application/vnd.google-apps.");
}

export async function getDriveStartPageToken(token: string): Promise<string | null> {
  try {
    const res = await driveFetch(`${API}/changes/startPageToken`, token);
    const data = (await res.json()) as { startPageToken?: string };
    return data.startPageToken ?? null;
  } catch {
    return null;
  }
}

export interface DriveChange {
  fileId: string;
  removed: boolean;
  file?: DriveFile;
}

export async function listDriveChanges(opts: {
  token: string;
  pageToken: string;
  fileFields?: string;
}): Promise<{
  changes: DriveChange[];
  newStartPageToken: string | null;
  invalidToken: boolean;
}> {
  const changes: DriveChange[] = [];
  let pageToken: string | undefined = opts.pageToken;
  let newStartPageToken: string | null = null;
  const fileFields = opts.fileFields ?? CLEANUP_FILE_FIELDS;
  const maxPages = 40;

  for (let i = 0; i < maxPages && pageToken; i++) {
    const params = new URLSearchParams({
      pageToken,
      pageSize: "100",
      fields: `nextPageToken,newStartPageToken,changes(fileId,removed,file(${fileFields}))`,
      spaces: "drive",
    });
    try {
      const res = await driveFetch(`${API}/changes?${params}`, opts.token);
      const data = (await res.json()) as {
        changes?: Array<{ fileId?: string; removed?: boolean; file?: DriveFile }>;
        nextPageToken?: string;
        newStartPageToken?: string;
      };
      for (const change of data.changes ?? []) {
        if (!change.fileId) continue;
        changes.push({
          fileId: change.fileId,
          removed: !!change.removed || !!change.file?.trashed,
          file: change.file,
        });
      }
      newStartPageToken = data.newStartPageToken ?? newStartPageToken;
      pageToken = data.nextPageToken;
    } catch (err) {
      if (err instanceof DriveApiError && (err.status === 410 || err.status === 400)) {
        return { changes: [], newStartPageToken: null, invalidToken: true };
      }
      throw err;
    }
  }

  return { changes, newStartPageToken, invalidToken: false };
}

export function humanFileSize(bytes?: string | number): string {
  if (bytes === undefined || bytes === null || bytes === "") return "—";
  const n = typeof bytes === "string" ? parseInt(bytes, 10) : bytes;
  if (!Number.isFinite(n)) return "—";
  if (n < 1024) return `${n} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = n / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[i]}`;
}
