import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

/** App session length — refresh token may only be used within this window. */
export const AUTH_SESSION_MS = 24 * 60 * 60 * 1000;

export interface AuthSessionPayload {
  refreshToken: string;
  sessionExpiresAt: number;
}

function encryptionKey(secret: string): Buffer {
  return createHash("sha256").update(secret).digest();
}

export function sealAuthSession(data: AuthSessionPayload, secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(secret), iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(data), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString("base64url")}.${tag.toString("base64url")}.${ciphertext.toString("base64url")}`;
}

export function openAuthSession(token: string, secret: string): AuthSessionPayload | null {
  try {
    const [version, iv, tag, ciphertext, ...extra] = token.split(".");
    if (version !== "v1" || !iv || !tag || !ciphertext || extra.length > 0) return null;
    const decipher = createDecipheriv(
      "aes-256-gcm",
      encryptionKey(secret),
      Buffer.from(iv, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(ciphertext, "base64url")),
      decipher.final(),
    ]).toString("utf8");
    const payload = JSON.parse(plaintext) as AuthSessionPayload;
    if (
      typeof payload.refreshToken !== "string" ||
      !payload.refreshToken ||
      typeof payload.sessionExpiresAt !== "number" ||
      !Number.isFinite(payload.sessionExpiresAt)
    ) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}
