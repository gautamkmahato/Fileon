"use client";

import {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
} from "react";
import type { SavedView } from "@/lib/views";
import { listViews, subscribeViews } from "@/lib/views";

interface ViewsContextValue {
  views: SavedView[];
  loading: boolean;
  refresh: () => Promise<void>;
}

const ViewsContext = createContext<ViewsContextValue | null>(null);

export function ViewsProvider({ children }: { children: React.ReactNode }) {
  const [views, setViews] = useState<SavedView[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const rows = await listViews();
    setViews(rows);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    return subscribeViews(() => { refresh(); });
  }, [refresh]);

  const value = useMemo(
    () => ({ views, loading, refresh }),
    [views, loading, refresh]
  );

  return <ViewsContext.Provider value={value}>{children}</ViewsContext.Provider>;
}

export function useViews() {
  const ctx = useContext(ViewsContext);
  if (!ctx) throw new Error("useViews must be used inside ViewsProvider");
  return ctx;
}
