import { createHmac, timingSafeEqual } from "crypto";

/** App session length — refresh token may only be used within this window. */
export const AUTH_SESSION_MS = 24 * 60 * 60 * 1000;

export interface AuthSessionPayload {
  refreshToken: string;
  sessionExpiresAt: number;
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function sealAuthSession(data: AuthSessionPayload, secret: string): string {
  const payload = Buffer.from(JSON.stringify(data)).toString("base64url");
  return `${payload}.${sign(payload, secret)}`;
}

export function openAuthSession(token: string, secret: string): AuthSessionPayload | null {
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = sign(payload, secret);
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as AuthSessionPayload;
  } catch {
    return null;
  }
}
