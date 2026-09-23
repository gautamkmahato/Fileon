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
import type { TokenClient, TokenResponse } from "@/lib/types/google-types";
import { fetchUserProfile, setDriveTokenRefresh, UserProfile } from "@/lib/drive/drive";
import { clearFolderChildrenCache } from "@/lib/cache/folder-children-cache";
import { clearTypeBrowseCountsCache } from "@/lib/cache/type-browse-counts-cache";
import { clearFolderItemCountCache } from "@/lib/cache/folder-item-count-cache";

/**
 * Scopes:
 *
 *  - drive.file: only files YOUR APP creates, or files the user explicitly
 *    opens via Google Picker. No verification needed.
 *  - drive.readonly: read all the user's Drive. Requires Google review.
 *
 * Default: drive.file + ability to open via Picker. Swap to drive.readonly
 * if you want to list every file the user owns without explicit picking.
 */
const SCOPES = [
    "https://www.googleapis.com/auth/drive",
    "openid",
    "email",
    "profile",
  ].join(" ");

const TOKEN_STORAGE_KEY = "drive_ui_token";

interface StoredToken {
  access_token: string;
  expires_at: number; // unix ms
}

interface AuthState {
  isReady: boolean; // GSI script loaded
  isSignedIn: boolean;
  token: string | null;
  profile: UserProfile | null;
  signIn: () => void;
  signOut: () => void;
  /** Used by drive-api calls when 401 indicates expired token. */
  refreshToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const tokenClientRef = useRef<TokenClient | null>(null);
  const pendingRefreshRef = useRef<Promise<string | null> | null>(null);
  const refreshResolverRef = useRef<((token: string | null) => void) | null>(null);

  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

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

  // Initialize the token client once GSI is loaded
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
        const expiresAt = Date.now() + response.expires_in * 1000;
        const stored: StoredToken = {
          access_token: response.access_token,
          expires_at: expiresAt,
        };
        try {
          sessionStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(stored));
        } catch {
          // sessionStorage might be unavailable; that's fine, token still in memory.
        }
        setToken(response.access_token);
        // Resolve any pending refresh
        refreshResolverRef.current?.(response.access_token);
        refreshResolverRef.current = null;
        pendingRefreshRef.current = null;
      },
      error_callback: (err) => {
        console.error("[auth] token client error:", err);
        refreshResolverRef.current?.(null);
        refreshResolverRef.current = null;
        pendingRefreshRef.current = null;
      },
    });

    // Restore a non-expired token from sessionStorage
    try {
      const raw = sessionStorage.getItem(TOKEN_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as StoredToken;
        // Reject tokens with <60s left to avoid 401 race conditions.
        if (parsed.expires_at > Date.now() + 60_000) {
          setToken(parsed.access_token);
        } else {
          sessionStorage.removeItem(TOKEN_STORAGE_KEY);
        }
      }
    } catch {
      // ignore
    }
  }, [isReady, clientId]);

  // Fetch user profile whenever we get a new token
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
    if (!tokenClientRef.current) {
      console.warn("[auth] token client not ready");
      return;
    }
    tokenClientRef.current.requestAccessToken({ prompt: "consent" });
  }, []);

  const signOut = useCallback(() => {
    if (token && window.google?.accounts) {
      window.google.accounts.oauth2.revoke(token);
    }
    sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    clearFolderChildrenCache();
    clearTypeBrowseCountsCache();
    clearFolderItemCountCache();
    setToken(null);
    setProfile(null);
  }, [token]);

  /**
   * Re-issue an access token silently when the current one expires.
   * Returns the new token, or null if user interaction is required.
   */
  const refreshToken = useCallback((): Promise<string | null> => {
    if (pendingRefreshRef.current) return pendingRefreshRef.current;
    if (!tokenClientRef.current) return Promise.resolve(null);

    const p = new Promise<string | null>((resolve) => {
      refreshResolverRef.current = resolve;
      // prompt: '' attempts silent token issuance — works as long as the user
      // hasn't revoked consent. If it requires interaction, the popup appears.
      tokenClientRef.current!.requestAccessToken({ prompt: "" });
    });
    pendingRefreshRef.current = p;
    return p;
  }, []);

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
    [isReady, token, profile, signIn, signOut, refreshToken]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}