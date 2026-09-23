import { MAX_ERROR_LEN, MAX_ID_LEN, MAX_NAME_LEN, MAX_REASON_LEN } from "./schema";

const USER_ID_RE = /^[\w.@:+-]{1,128}$/;
const FILE_ID_RE = /^[\x21-\x7E]{1,128}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

/** Google `sub` is the tenant key. Reject anything that could mix users. */
export function assertUserId(userId: string): string {
  const trimmed = (userId ?? "").trim();
  if (!USER_ID_RE.test(trimmed) || trimmed.length > MAX_ID_LEN) {
    throw new Error("Invalid user id");
  }
  return trimmed;
}

export function sanitizeUserId(userId: string | null | undefined): string | null {
  const trimmed = (userId ?? "").trim();
  if (!USER_ID_RE.test(trimmed)) return null;
  return trimmed.slice(0, MAX_ID_LEN);
}

export function tenantId(profile: { sub?: string; email?: string } | null | undefined): string | null {
  return sanitizeUserId(profile?.sub) ?? sanitizeUserId(profile?.email?.trim().toLowerCase());
}

export function sanitizeFileId(fileId: string | null | undefined): string | null {
  const trimmed = (fileId ?? "").trim();
  if (!FILE_ID_RE.test(trimmed)) return null;
  return trimmed.slice(0, MAX_ID_LEN);
}

export function sanitizeText(value: string | null | undefined, max: number): string {
  if (!value) return "";
  return value.replace(/\u0000/g, "").slice(0, max);
}

export function sanitizeName(value: string | null | undefined): string {
  const name = sanitizeText(value, MAX_NAME_LEN).trim();
  return name || "Untitled";
}

export function sanitizeReason(value: string | null | undefined): string {
  return sanitizeText(value, MAX_REASON_LEN);
}

export function sanitizeError(value: string | null | undefined): string | null {
  if (!value) return null;
  return sanitizeText(value, MAX_ERROR_LEN);
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function parseSizeBytes(size?: string | number | null): number | null {
  if (size === undefined || size === null || size === "") return null;
  const n = typeof size === "string" ? Number(size) : size;
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.floor(n);
}

export function parseIso(value?: string | null): string | null {
  if (!value) return null;
  const t = Date.parse(value);
  if (!Number.isFinite(t)) return null;
  return new Date(t).toISOString();
}
