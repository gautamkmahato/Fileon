"use client";

import { useEffect, useSyncExternalStore } from "react";
import type { TypeBrowseCategory } from "@/lib/drive/type-browse";
import {
  type TypeBrowseCount,
  EMPTY_TYPE_BROWSE_COUNTS,
  getCachedTypeBrowseCounts,
  loadTypeBrowseCounts,
  subscribeTypeBrowseCounts,
} from "@/lib/cache/type-browse-counts-cache";

export type { TypeBrowseCount };

export function useTypeBrowseCounts(token: string | null) {
  const counts = useSyncExternalStore(
    subscribeTypeBrowseCounts,
    getCachedTypeBrowseCounts,
    () => EMPTY_TYPE_BROWSE_COUNTS,
  );

  useEffect(() => {
    if (!token) return;
    void loadTypeBrowseCounts(token);
  }, [token]);

  if (!token) return EMPTY_TYPE_BROWSE_COUNTS;
  return counts;
}
