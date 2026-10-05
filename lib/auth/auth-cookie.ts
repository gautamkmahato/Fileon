import { cookies } from "next/headers";
import {
  AUTH_SESSION_MS,
  type AuthSessionPayload,
  openAuthSession,
  sealAuthSession,
} from "./auth-session";

export const AUTH_COOKIE_NAME = "fileon_auth";

function getAuthSecret(): string | null {
  const secret = process.env.AUTH_SESSION_SECRET;
  return secret && secret.length >= 16 ? secret : null;
}

function getGoogleOAuthConfig() {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

export function isServerAuthConfigured(): boolean {
  return !!getAuthSecret() && !!getGoogleOAuthConfig();
}

export async function readAuthSession(): Promise<AuthSessionPayload | null> {
  const secret = getAuthSecret();
  if (!secret) return null;
  const jar = await cookies();
  const raw = jar.get(AUTH_COOKIE_NAME)?.value;
  if (!raw) return null;
  const session = openAuthSession(raw, secret);
  if (!session) return null;
  if (session.sessionExpiresAt <= Date.now()) return null;
  return session;
}

export async function writeAuthSession(refreshToken: string): Promise<void> {
  const secret = getAuthSecret();
  if (!secret) throw new Error("AUTH_SESSION_SECRET is not configured");
  const payload: AuthSessionPayload = {
    refreshToken,
    sessionExpiresAt: Date.now() + AUTH_SESSION_MS,
  };
  const jar = await cookies();
  jar.set(AUTH_COOKIE_NAME, sealAuthSession(payload, secret), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(AUTH_SESSION_MS / 1000),
  });
}

export async function clearAuthSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(AUTH_COOKIE_NAME);
}

export function getGoogleOAuth() {
  return getGoogleOAuthConfig();
}
