"use client";

import {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
} from "react";
import type { CoverPosition, FolderCoverRecord } from "@/lib/folder-covers";
import {
  listFolderCovers,
  removeFolderCover as removeFolderCoverDb,
  setFolderCover as setFolderCoverDb,
  subscribeFolderCovers,
} from "@/lib/folder-covers";

interface FolderCoversContextValue {
  covers: Map<string, FolderCoverRecord>;
  loading: boolean;
  refresh: () => Promise<void>;
  getCover: (folderId: string) => FolderCoverRecord | null;
  setCover: (folderId: string, coverFileId: string, position?: CoverPosition) => Promise<void>;
  removeCover: (folderId: string) => Promise<void>;
}

const FolderCoversContext = createContext<FolderCoversContextValue | null>(null);

export function FolderCoversProvider({ children }: { children: React.ReactNode }) {
  const [covers, setCovers] = useState<Map<string, FolderCoverRecord>>(new Map());
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const rows = await listFolderCovers();
    setCovers(new Map(rows.map((r) => [r.folderId, r])));
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    return subscribeFolderCovers(refresh);
  }, [refresh]);

  const getCover = useCallback(
    (folderId: string) => covers.get(folderId) ?? null,
    [covers],
  );

  const value = useMemo(
    (): FolderCoversContextValue => ({
      covers,
      loading,
      refresh,
      getCover,
      setCover: async (folderId, coverFileId, position = "center") => {
        await setFolderCoverDb(folderId, coverFileId, position);
      },
      removeCover: removeFolderCoverDb,
    }),
    [covers, loading, refresh, getCover],
  );

  return (
    <FolderCoversContext.Provider value={value}>{children}</FolderCoversContext.Provider>
  );
}

export function useFolderCovers() {
  const ctx = useContext(FolderCoversContext);
  if (!ctx) throw new Error("useFolderCovers must be used inside FolderCoversProvider");
  return ctx;
}

export function useFolderCover(folderId: string): FolderCoverRecord | null {
  return useFolderCovers().getCover(folderId);
}

export function useHasFolderCover(folderId: string): boolean {
  return useFolderCovers().getCover(folderId) !== null;
}
