"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { CodeClient, TokenClient, TokenResponse } from "@/lib/types/google-types";
import { fetchUserProfile, setDriveTokenRefresh, UserProfile } from "@/lib/drive/drive";
import { clearAllSessionCaches } from "@/lib/cache/session-cache";
import { clearFilesListSnapshot, openFilesListSnapshot, setFilesCacheUser } from "@/lib/stores/files-cache";

/**
 * Scopes:
 *
 *  - drive: list and manage the user's Google Drive (restricted; Google OAuth
 *    verification and CASA may be required for production use).
 *  - openid / email / profile: who is signed in.
 */
const SCOPES = [
  "https://www.googleapis.com/auth/drive",
  "openid",
  "email",
  "profile",
].join(" ");

const TOKEN_STORAGE_KEY = "drive_ui_token_v4";
const REFRESH_BUFFER_MS = 5 * 60 * 1000;

/** When true, sign-in uses auth code + server refresh token (24h app session). */
const USE_SERVER_REFRESH =
  process.env.NEXT_PUBLIC_GOOGLE_SERVER_AUTH === "true";

interface StoredToken {
  access_token: string;
  expires_at: number;
}

interface AuthState {
  isReady: boolean;
  isSignedIn: boolean;
  token: string | null;
  profile: UserProfile | null;
  signIn: () => void;
  signOut: () => void;
  refreshToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

async function fetchServerAccessToken(): Promise<StoredToken | null> {
  try {
    const res = await fetch("/api/auth/refresh", { method: "POST", credentials: "same-origin" });
    if (!res.ok) return null;
    const data = (await res.json()) as { access_token: string; expires_in: number };
    return {
      access_token: data.access_token,
      expires_at: Date.now() + data.expires_in * 1000,
    };
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const tokenClientRef = useRef<TokenClient | null>(null);
  const codeClientRef = useRef<CodeClient | null>(null);
  const pendingRefreshRef = useRef<Promise<string | null> | null>(null);
  const refreshResolverRef = useRef<((token: string | null) => void) | null>(null);
  const proactiveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  const persistAccessToken = useCallback((accessToken: string, expiresAtMs: number) => {
    const stored: StoredToken = {
      access_token: accessToken,
      expires_at: expiresAtMs,
    };
    try {
      sessionStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(stored));
    } catch {
      /* sessionStorage unavailable */
    }
    setToken(accessToken);
    setExpiresAt(expiresAtMs);
  }, []);

  const clearLocalAuth = useCallback(() => {
    sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    setToken(null);
    setExpiresAt(null);
    setProfile(null);
  }, []);

  const applyAccessToken = useCallback((accessToken: string, expiresInSec: number) => {
    const expiresAtMs = Date.now() + expiresInSec * 1000;
    persistAccessToken(accessToken, expiresAtMs);
    refreshResolverRef.current?.(accessToken);
    refreshResolverRef.current = null;
    pendingRefreshRef.current = null;
  }, [persistAccessToken]);

  // Load Google Identity Services script
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.google?.accounts) {
      setIsReady(true);
      return;
    }
    const existing = document.getElementById("gsi-script") as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => setIsReady(true), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.id = "gsi-script";
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => setIsReady(true);
    document.head.appendChild(script);
  }, []);

  const refreshFromServer = useCallback(async (): Promise<string | null> => {
    const stored = await fetchServerAccessToken();
    if (!stored) return null;
    persistAccessToken(stored.access_token, stored.expires_at);
    return stored.access_token;
  }, [persistAccessToken]);

  const refreshToken = useCallback((): Promise<string | null> => {
    if (pendingRefreshRef.current) return pendingRefreshRef.current;

    const p = (async (): Promise<string | null> => {
      if (USE_SERVER_REFRESH) {
        const fresh = await refreshFromServer();
        if (fresh) return fresh;
        clearLocalAuth();
        return null;
      }
      if (!tokenClientRef.current) return null;
      return new Promise<string | null>((resolve) => {
        refreshResolverRef.current = resolve;
        tokenClientRef.current!.requestAccessToken({ prompt: "" });
      });
    })();

    pendingRefreshRef.current = p;
    p.finally(() => {
      if (pendingRefreshRef.current === p) pendingRefreshRef.current = null;
    });
    return p;
  }, [clearLocalAuth, refreshFromServer]);

  // Initialize Google OAuth clients
  useEffect(() => {
    if (!isReady || !window.google?.accounts) return;
    if (!clientId) {
      console.error("NEXT_PUBLIC_GOOGLE_CLIENT_ID is not set.");
      return;
    }

    tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPES,
      callback: (response: TokenResponse) => {
        applyAccessToken(response.access_token, response.expires_in);
      },
      error_callback: (err) => {
        console.error("[auth] token client error:", err);
        refreshResolverRef.current?.(null);
        refreshResolverRef.current = null;
        pendingRefreshRef.current = null;
      },
    });

    if (USE_SERVER_REFRESH) {
      codeClientRef.current = window.google.accounts.oauth2.initCodeClient({
        client_id: clientId,
        scope: SCOPES,
        ux_mode: "popup",
        callback: (response) => {
          void (async () => {
            try {
              const res = await fetch("/api/auth/google", {
                method: "POST",
                credentials: "same-origin",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  code: response.code,
                  redirectUri: window.location.origin,
                }),
              });
              if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error((err as { error?: string }).error ?? "Sign-in failed");
              }
              const data = (await res.json()) as { access_token: string; expires_in: number };
              applyAccessToken(data.access_token, data.expires_in);
            } catch (err) {
              console.error("[auth] code exchange failed:", err);
              refreshResolverRef.current?.(null);
              refreshResolverRef.current = null;
              pendingRefreshRef.current = null;
            }
          })();
        },
        error_callback: (err) => {
          console.error("[auth] code client error:", err);
        },
      });
    }

    void (async () => {
      try {
        const raw = sessionStorage.getItem(TOKEN_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as StoredToken;
          if (parsed.expires_at > Date.now() + 60_000) {
            persistAccessToken(parsed.access_token, parsed.expires_at);
            return;
          }
          sessionStorage.removeItem(TOKEN_STORAGE_KEY);
        }
      } catch {
        /* ignore */
      }

      if (USE_SERVER_REFRESH) {
        await refreshFromServer();
      }
    })();
  }, [isReady, clientId, applyAccessToken, persistAccessToken, refreshFromServer]);

  // Proactively refresh access token before it expires (Google tokens are ~1h).
  useEffect(() => {
    if (proactiveTimerRef.current) {
      clearTimeout(proactiveTimerRef.current);
      proactiveTimerRef.current = null;
    }
    if (!token || !expiresAt) return;

    const delay = Math.max(0, expiresAt - Date.now() - REFRESH_BUFFER_MS);
    proactiveTimerRef.current = setTimeout(() => {
      void refreshToken();
    }, delay);

    return () => {
      if (proactiveTimerRef.current) clearTimeout(proactiveTimerRef.current);
    };
  }, [token, expiresAt, refreshToken]);

  useEffect(() => {
    if (token) openFilesListSnapshot();
  }, [token]);

  useEffect(() => {
    setFilesCacheUser(profile?.sub ?? null);
  }, [profile]);

  useEffect(() => {
    if (!token) {
      setProfile(null);
      return;
    }
    let cancelled = false;
    fetchUserProfile(token)
      .then((p) => {
        if (!cancelled) setProfile(p);
      })
      .catch((err) => {
        console.error("[auth] profile fetch failed:", err);
        if (!cancelled) setProfile(null);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const signIn = useCallback(() => {
    if (USE_SERVER_REFRESH) {
      if (!codeClientRef.current) {
        console.warn("[auth] code client not ready");
        return;
      }
      codeClientRef.current.requestCode({ prompt: "consent" });
      return;
    }
    if (!tokenClientRef.current) {
      console.warn("[auth] token client not ready");
      return;
    }
    tokenClientRef.current.requestAccessToken({ prompt: "consent" });
  }, []);

  const signOut = useCallback(() => {
    void (async () => {
      if (USE_SERVER_REFRESH) {
        try {
          await fetch("/api/auth/signout", { method: "POST", credentials: "same-origin" });
        } catch {
          /* ignore */
        }
      } else if (token && window.google?.accounts) {
        window.google.accounts.oauth2.revoke(token);
      }
      sessionStorage.removeItem(TOKEN_STORAGE_KEY);
      clearFilesListSnapshot();
      clearAllSessionCaches();
      clearLocalAuth();
    })();
  }, [token, clearLocalAuth]);

  useEffect(() => {
    setDriveTokenRefresh(refreshToken);
    return () => setDriveTokenRefresh(null);
  }, [refreshToken]);

  const value = useMemo<AuthState>(
    () => ({
      isReady,
      isSignedIn: token !== null,
      token,
      profile,
      signIn,
      signOut,
      refreshToken,
    }),
    [isReady, token, profile, signIn, signOut, refreshToken],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
