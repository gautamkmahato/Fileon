"use client";

import { useEffect, useMemo, useState } from "react";
import type { DriveFile } from "@/lib/drive/drive";
import { fetchAllFilesByIds, isFolder } from "@/lib/drive/drive";
import { listFavoriteFolderIds, subscribeFavorites } from "@/lib/favorites";
import { listRecentFolderIds, subscribeRecentFolders } from "@/lib/recent-folders";

const RECENT_CAP = 3;

async function loadFolders(token: string, ids: string[]): Promise<DriveFile[]> {
  if (!token || ids.length === 0) return [];
  const files = await fetchAllFilesByIds(token, ids);
  const byId = new Map(files.map((f) => [f.id, f]));
  return ids
    .map((id) => byId.get(id))
    .filter((f): f is DriveFile => !!f && isFolder(f));
}

export function useFolderShortcuts(token: string | null, pathname: string) {
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [recentTick, setRecentTick] = useState(0);
  const [favoriteFolders, setFavoriteFolders] = useState<DriveFile[]>([]);
  const [recentFolders, setRecentFolders] = useState<DriveFile[]>([]);

  const favoriteKey = favoriteIds.join(",");
  const recentIds = useMemo(
    () => listRecentFolderIds().slice(0, RECENT_CAP),
    [pathname, recentTick],
  );
  const recentKey = recentIds.join(",");

  useEffect(() => {
    let cancelled = false;
    void listFavoriteFolderIds()
      .then((ids) => { if (!cancelled) setFavoriteIds(ids.filter(Boolean)); })
      .catch(() => { if (!cancelled) setFavoriteIds([]); });
    const unsub = subscribeFavorites(() => {
      void listFavoriteFolderIds()
        .then((ids) => { if (!cancelled) setFavoriteIds(ids.filter(Boolean)); })
        .catch(() => { if (!cancelled) setFavoriteIds([]); });
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  useEffect(() => subscribeRecentFolders(() => setRecentTick((t) => t + 1)), []);

  useEffect(() => {
    let cancelled = false;
    if (!token || !favoriteIds.length) {
      setFavoriteFolders([]);
      return;
    }
    void loadFolders(token, favoriteIds)
      .then((folders) => { if (!cancelled) setFavoriteFolders(folders); })
      .catch(() => { if (!cancelled) setFavoriteFolders([]); });
    return () => { cancelled = true; };
  }, [token, favoriteKey]);

  useEffect(() => {
    let cancelled = false;
    if (!token || !recentIds.length) {
      setRecentFolders([]);
      return;
    }
    void loadFolders(token, recentIds)
      .then((folders) => { if (!cancelled) setRecentFolders(folders); })
      .catch(() => { if (!cancelled) setRecentFolders([]); });
    return () => { cancelled = true; };
  }, [token, recentKey]);

  return { favoriteFolders, recentFolders };
}
