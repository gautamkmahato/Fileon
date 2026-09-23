"use client";

import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from "react";
import {
  favoriteFolder,
  listFavoriteFolderIds,
  migrateFolderPinsToFavorites,
  subscribeFavorites,
  toggleFavoriteFolder,
  unfavoriteFolder,
} from "@/lib/favorites";
import { useAuth } from "../auth/AuthProvider";

interface FavoritesContextValue {
  favoriteIds: string[];
  loading: boolean;
  refresh: () => Promise<void>;
  isFavorite: (folderId: string) => boolean;
  favorite: (folderId: string) => Promise<void>;
  unfavorite: (folderId: string) => Promise<void>;
  toggleFavorite: (folderId: string) => Promise<boolean>;
}

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const migratedRef = useRef(false);

  const refresh = useCallback(async () => {
    if (token && !migratedRef.current) {
      migratedRef.current = true;
      await migrateFolderPinsToFavorites(token);
    }
    const ids = await listFavoriteFolderIds();
    setFavoriteIds(ids);
    setLoading(false);
  }, [token]);

  useEffect(() => {
    refresh();
    return subscribeFavorites(refresh);
  }, [refresh]);

  const favoriteIdSet = useMemo(() => new Set(favoriteIds), [favoriteIds]);

  const isFavorite = useCallback(
    (folderId: string) => favoriteIdSet.has(folderId),
    [favoriteIdSet],
  );

  const value = useMemo(
    (): FavoritesContextValue => ({
      favoriteIds,
      loading,
      refresh,
      isFavorite,
      favorite: async (folderId) => { await favoriteFolder(folderId); },
      unfavorite: unfavoriteFolder,
      toggleFavorite: toggleFavoriteFolder,
    }),
    [favoriteIds, loading, refresh, isFavorite],
  );

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites() {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error("useFavorites must be used inside FavoritesProvider");
  return ctx;
}

export function useIsFavorite(folderId: string): boolean {
  const { isFavorite } = useFavorites();
  return isFavorite(folderId);
}
