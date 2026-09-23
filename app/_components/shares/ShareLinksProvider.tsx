"use client";

import {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
} from "react";
import { useAuth } from "../auth/AuthProvider";
import { tenantId } from "@/lib/db/sanitize";
import {
  createShareLink as createRow,
  deleteShareLink as deleteRow,
  listShareLinks,
  listShareLinksForFile,
  mergeShareLinkCounts,
  revokeShareLink as revokeRow,
  subscribeShareLinks,
  updateShareLinkExpiry as updateExpiryRow,
  type ShareLink,
  type ShareLinkDraft,
} from "@/lib/shares";

interface ShareLinksContextValue {
  userId: string | null;
  links: ShareLink[];
  loading: boolean;
  refresh: () => Promise<void>;
  linksForFile: (fileId: string) => ShareLink[];
  createLink: (draft: ShareLinkDraft) => Promise<ShareLink>;
  revokeLink: (id: string) => Promise<ShareLink | null>;
  updateExpiry: (id: string, expiresAt: string | null) => Promise<ShareLink | null>;
  removeLink: (id: string) => Promise<boolean>;
}

const ShareLinksContext = createContext<ShareLinksContextValue | null>(null);

export function ShareLinksProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  const userId = tenantId(profile);
  const [links, setLinks] = useState<ShareLink[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!userId) {
      setLinks([]);
      setLoading(false);
      return;
    }
    try {
      const merged = await mergeShareLinkCounts(userId);
      setLinks(merged);
    } catch (err) {
      console.error(err);
      try {
        setLinks(await listShareLinks(userId));
      } catch {
        setLinks([]);
      }
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    setLoading(true);
    void refresh();
    return subscribeShareLinks(() => { void refresh(); });
  }, [refresh]);

  const linksForFile = useCallback(
    (fileId: string) => links.filter((l) => l.fileId === fileId),
    [links],
  );

  const createLink = useCallback(async (draft: ShareLinkDraft) => {
    if (!userId) throw new Error("Sign in to create a share link");
    return createRow(userId, draft);
  }, [userId]);

  const revokeLink = useCallback(async (id: string) => {
    if (!userId) return null;
    return revokeRow(userId, id);
  }, [userId]);

  const updateExpiry = useCallback(async (id: string, expiresAt: string | null) => {
    if (!userId) return null;
    return updateExpiryRow(userId, id, expiresAt);
  }, [userId]);

  const removeLink = useCallback(async (id: string) => {
    if (!userId) return false;
    return deleteRow(userId, id);
  }, [userId]);

  const value = useMemo(
    () => ({
      userId,
      links,
      loading,
      refresh,
      linksForFile,
      createLink,
      revokeLink,
      updateExpiry,
      removeLink,
    }),
    [userId, links, loading, refresh, linksForFile, createLink, revokeLink, updateExpiry, removeLink],
  );

  return <ShareLinksContext.Provider value={value}>{children}</ShareLinksContext.Provider>;
}

export function useShareLinks() {
  const ctx = useContext(ShareLinksContext);
  if (!ctx) throw new Error("useShareLinks must be used inside ShareLinksProvider");
  return ctx;
}

export async function loadLinksForFile(userId: string, fileId: string): Promise<ShareLink[]> {
  return listShareLinksForFile(userId, fileId);
}
