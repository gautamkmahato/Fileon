"use client";

import {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
} from "react";
import {
  hideFile,
  hideFiles,
  listHiddenFileIds,
  subscribeHidden,
  toggleHidden as toggleHiddenDb,
  unhideFile,
  unhideFiles,
} from "@/lib/hidden";

interface HiddenContextValue {
  hiddenIds: Set<string>;
  loading: boolean;
  refresh: () => Promise<void>;
  isHidden: (fileId: string) => boolean;
  hide: (fileId: string) => Promise<void>;
  unhide: (fileId: string) => Promise<void>;
  hideMany: (fileIds: string[]) => Promise<void>;
  unhideMany: (fileIds: string[]) => Promise<void>;
  toggleHidden: (fileId: string) => Promise<boolean>;
}

const HiddenContext = createContext<HiddenContextValue | null>(null);

export function HiddenProvider({ children }: { children: React.ReactNode }) {
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const ids = await listHiddenFileIds();
    setHiddenIds(new Set(ids));
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    return subscribeHidden(refresh);
  }, [refresh]);

  const isHidden = useCallback(
    (fileId: string) => hiddenIds.has(fileId),
    [hiddenIds],
  );

  const value = useMemo(
    (): HiddenContextValue => ({
      hiddenIds,
      loading,
      refresh,
      isHidden,
      hide: async (fileId) => { await hideFile(fileId); },
      unhide: async (fileId) => { await unhideFile(fileId); },
      hideMany: hideFiles,
      unhideMany: unhideFiles,
      toggleHidden: toggleHiddenDb,
    }),
    [hiddenIds, loading, refresh, isHidden],
  );

  return <HiddenContext.Provider value={value}>{children}</HiddenContext.Provider>;
}

export function useHidden() {
  const ctx = useContext(HiddenContext);
  if (!ctx) throw new Error("useHidden must be used inside HiddenProvider");
  return ctx;
}

export function useIsHidden(fileId: string): boolean {
  return useHidden().isHidden(fileId);
}
