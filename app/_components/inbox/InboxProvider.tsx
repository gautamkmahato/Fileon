"use client";

import {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
} from "react";
import {
  addToInbox,
  listInboxFileIds,
  removeFromInbox,
  subscribeInbox,
} from "@/lib/inbox";

interface InboxContextValue {
  inboxIds: Set<string>;
  loading: boolean;
  refresh: () => Promise<void>;
  isInInbox: (fileId: string) => boolean;
  add: (fileIds: string[]) => Promise<void>;
  archive: (fileIds: string[]) => Promise<void>;
}

const InboxContext = createContext<InboxContextValue | null>(null);

export function InboxProvider({ children }: { children: React.ReactNode }) {
  const [inboxIds, setInboxIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const ids = await listInboxFileIds();
      setInboxIds(new Set(ids));
    } catch {
      setInboxIds(new Set());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    return subscribeInbox(() => { void refresh(); });
  }, [refresh]);

  const isInInbox = useCallback(
    (fileId: string) => !!fileId && inboxIds.has(fileId),
    [inboxIds],
  );

  const value = useMemo(
    (): InboxContextValue => ({
      inboxIds,
      loading,
      refresh,
      isInInbox,
      add: addToInbox,
      archive: removeFromInbox,
    }),
    [inboxIds, loading, refresh, isInInbox],
  );

  return <InboxContext.Provider value={value}>{children}</InboxContext.Provider>;
}

export function useInbox() {
  const ctx = useContext(InboxContext);
  if (!ctx) throw new Error("useInbox must be used inside InboxProvider");
  return ctx;
}
