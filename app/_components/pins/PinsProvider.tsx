"use client";

import {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
} from "react";
import {
  listAllPins,
  DASHBOARD_PINS_KEY,
  migrateRootPinsToDashboard,
  pinItem,
  reorderPins as reorderPinsDb,
  subscribePins,
  togglePin as togglePinDb,
  unpinItem,
  type PinRecord,
} from "@/lib/pins";
import { useDriveRoute } from "@/lib/drive/useDriveRoute";

interface PinsContextValue {
  pinsByFolder: Map<string, PinRecord[]>;
  loading: boolean;
  refresh: () => Promise<void>;
  getOrderedPinIds: (folderId: string) => string[];
  isPinned: (folderId: string, fileId: string) => boolean;
  togglePin: (folderId: string, fileId: string) => Promise<boolean>;
  pin: (folderId: string, fileId: string) => Promise<void>;
  unpin: (folderId: string, fileId: string) => Promise<void>;
  reorderPins: (folderId: string, orderedFileIds: string[]) => Promise<void>;
}

const PinsContext = createContext<PinsContextValue | null>(null);

function groupByFolder(records: PinRecord[]): Map<string, PinRecord[]> {
  const map = new Map<string, PinRecord[]>();
  for (const row of records) {
    const list = map.get(row.folderId) ?? [];
    list.push(row);
    map.set(row.folderId, list);
  }
  for (const [folderId, list] of map) {
    map.set(folderId, list.sort((a, b) => a.order - b.order));
  }
  return map;
}

export function PinsProvider({ children }: { children: React.ReactNode }) {
  const [pinsByFolder, setPinsByFolder] = useState<Map<string, PinRecord[]>>(new Map());
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    await migrateRootPinsToDashboard();
    const all = await listAllPins();
    setPinsByFolder(groupByFolder(all));
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    return subscribePins(refresh);
  }, [refresh]);

  const getOrderedPinIds = useCallback(
    (folderId: string) => (pinsByFolder.get(folderId) ?? []).map((p) => p.fileId),
    [pinsByFolder]
  );

  const isPinned = useCallback(
    (folderId: string, fileId: string) =>
      (pinsByFolder.get(folderId) ?? []).some((p) => p.fileId === fileId),
    [pinsByFolder]
  );

  const value = useMemo(
    (): PinsContextValue => ({
      pinsByFolder,
      loading,
      refresh,
      getOrderedPinIds,
      isPinned,
      togglePin: togglePinDb,
      pin: async (folderId, fileId) => { await pinItem(folderId, fileId); },
      unpin: async (folderId, fileId) => { await unpinItem(folderId, fileId); },
      reorderPins: reorderPinsDb,
    }),
    [pinsByFolder, loading, refresh, getOrderedPinIds, isPinned]
  );

  return <PinsContext.Provider value={value}>{children}</PinsContext.Provider>;
}

export function usePins() {
  const ctx = useContext(PinsContext);
  if (!ctx) throw new Error("usePins must be used inside PinsProvider");
  return ctx;
}

/** Dashboard pin scope — pinned items render on Dashboard only. */
export function usePinFolderKey(): string | null {
  const { isDashboardView, isTrashView } = useDriveRoute();
  if (!isDashboardView || isTrashView) return null;
  return DASHBOARD_PINS_KEY;
}

export function useIsPinned(fileId: string): boolean {
  const { isPinned } = usePins();
  return isPinned(DASHBOARD_PINS_KEY, fileId);
}
