"use client";

import {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
} from "react";
import type { Tag } from "@/lib/tags";
import {
  getTagCounts, getTagsByFileIdMap, listTags, subscribeTags, ensureBuiltinTags,
} from "@/lib/tags";
import { invalidateTagFileIdsCache } from "@/lib/cache/tag-file-ids-cache";
import { EMPTY_TAGS } from "@/lib/constants";

interface TagsContextValue {
  tags: Tag[];
  counts: Map<string, number>;
  tagsByFileId: Map<string, Tag[]>;
  loading: boolean;
  refresh: () => Promise<void>;
}

const TagsContext = createContext<TagsContextValue | null>(null);

export function TagsProvider({ children }: { children: React.ReactNode }) {
  const [tags, setTags] = useState<Tag[]>([]);
  const [counts, setCounts] = useState<Map<string, number>>(new Map());
  const [tagsByFileId, setTagsByFileId] = useState<Map<string, Tag[]>>(new Map());
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const [tagList, tagCounts, byFile] = await Promise.all([
      listTags(),
      getTagCounts(),
      getTagsByFileIdMap(),
    ]);
    setTags(tagList);
    setCounts(tagCounts);
    setTagsByFileId(byFile);
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void ensureBuiltinTags().then(() => {
      if (!cancelled) return refresh();
    });
    const unsub = subscribeTags(() => {
      invalidateTagFileIdsCache();
      refresh();
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, [refresh]);

  const value = useMemo(
    () => ({ tags, counts, tagsByFileId, loading, refresh }),
    [tags, counts, tagsByFileId, loading, refresh]
  );

  return <TagsContext.Provider value={value}>{children}</TagsContext.Provider>;
}

export function useTags() {
  const ctx = useContext(TagsContext);
  if (!ctx) throw new Error("useTags must be used inside TagsProvider");
  return ctx;
}

export function useFileTags(fileId: string): Tag[] {
  const { tagsByFileId } = useTags();
  return tagsByFileId.get(fileId) ?? (EMPTY_TAGS as Tag[]);
}
