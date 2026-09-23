/**
 * Extras for the Drive API — permissions.
 * Keep this in a separate file so the main drive.ts stays focused; import these
 * the same way as the other helpers.
 */

const API = "https://www.googleapis.com/drive/v3";

export interface DrivePermission {
  id: string;
  type: "user" | "group" | "domain" | "anyone";
  role: "owner" | "organizer" | "fileOrganizer" | "writer" | "commenter" | "reader";
  emailAddress?: string;
  displayName?: string;
  photoLink?: string;
}

async function call(token: string, url: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init.headers || {}) },
  });
  if (!res.ok) throw new Error(`Permissions API ${res.status}: ${await res.text()}`);
  return res;
}

export async function listPermissions(token: string, fileId: string): Promise<DrivePermission[]> {
  const params = new URLSearchParams({
    fields: "permissions(id,type,role,emailAddress,displayName,photoLink)",
  });
  const res = await call(token, `${API}/files/${fileId}/permissions?${params}`);
  const data = await res.json();
  return data.permissions || [];
}

/**
 * Add a permission. For email-based shares, sendNotificationEmail defaults to true
 * (Google will email the user to let them know).
 */
export async function addPermission(opts: {
  token: string;
  fileId: string;
  emailAddress?: string;
  role: "reader" | "commenter" | "writer";
  type?: "user" | "anyone";
  sendNotificationEmail?: boolean;
  message?: string;
}): Promise<DrivePermission> {
  const { token, fileId, emailAddress, role, type = "user", sendNotificationEmail, message } = opts;
  const params = new URLSearchParams();
  if (sendNotificationEmail === false) params.set("sendNotificationEmail", "false");
  if (message) params.set("emailMessage", message);

  const body: Record<string, unknown> = { role, type };
  if (type === "user" && emailAddress) body.emailAddress = emailAddress;

  const res = await call(token, `${API}/files/${fileId}/permissions?${params}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

export async function removePermission(token: string, fileId: string, permissionId: string): Promise<void> {
  await call(token, `${API}/files/${fileId}/permissions/${permissionId}`, {
    method: "DELETE",
  });
}

export async function updatePermissionRole(
  token: string,
  fileId: string,
  permissionId: string,
  role: "reader" | "commenter" | "writer"
): Promise<DrivePermission> {
  const res = await call(token, `${API}/files/${fileId}/permissions/${permissionId}?fields=id,type,role,emailAddress`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role }),
  });
  return res.json();
}