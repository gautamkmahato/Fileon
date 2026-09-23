"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Inbox, Loader2, Search } from "lucide-react";
import type { DriveFile } from "@/lib/drive/drive";
import { useFilesStore } from "@/lib/stores";
import { useDriveBrowse } from "../drive/context/DriveBrowseProvider";
import { useInbox } from "./InboxProvider";
import { InboxList } from "./InboxList";
import { InboxReadingPane } from "./InboxReadingPane";
import { toast } from "@/lib/toast";

export function InboxPageView() {
  const {
    files, loading, error, loadFiles,
    handleToggleStar, handleToggleHidden, handleTrashFiles,
    setRenameTarget, setMoveTargets, openTagPicker,
  } = useDriveBrowse();
  const { archive } = useInbox();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = files.filter((f) => f?.id && !f.trashed);
    if (!q) return list;
    return list.filter((f) => (f.name ?? "").toLowerCase().includes(q));
  }, [files, query]);

  const selected = useMemo(
    () => items.find((f) => f.id === selectedId) ?? null,
    [items, selectedId],
  );

  useEffect(() => {
    if (selectedId && !items.some((f) => f.id === selectedId)) {
      setSelectedId(null);
    }
  }, [items, selectedId]);

  const selectAndKeep = useCallback((file: DriveFile) => {
    if (!file?.id) return;
    setSelectedId(file.id);
  }, []);

  const selectNextAfter = useCallback((removedId: string) => {
    const idx = items.findIndex((f) => f.id === removedId);
    const next = items[idx + 1] ?? items[idx - 1] ?? null;
    setSelectedId(next?.id ?? null);
  }, [items]);

  async function handleArchive() {
    if (!selected) return;
    const id = selected.id;
    const idx = items.findIndex((f) => f.id === id);
    const next = items[idx + 1] ?? items[idx - 1] ?? null;
    try {
      await archive([id]);
      useFilesStore.getState().removeFile(id);
      toast.success(`Archived "${selected.name || "file"}"`);
      setSelectedId(next && next.id !== id ? next.id : null);
    } catch {
      toast.error("Couldn't archive that file");
    }
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      if (!items.length) return;
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const idx = items.findIndex((f) => f.id === selectedId);
        if (idx < 0) {
          const pick = e.key === "ArrowDown" ? items[0] : items[items.length - 1];
          if (pick) setSelectedId(pick.id);
          return;
        }
        const next = e.key === "ArrowDown"
          ? items[Math.min(items.length - 1, idx + 1)]
          : items[Math.max(0, idx - 1)];
        if (next) setSelectedId(next.id);
        return;
      }
      if (e.key === "Escape") {
        setSelectedId(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [items, selectedId]);

  return (
    <div className="flex-1 min-h-0 flex border border-zinc-200/80 dark:border-zinc-800 rounded-xl overflow-hidden bg-white dark:bg-zinc-950">
      <div className="w-[340px] shrink-0 border-r border-zinc-200/80 dark:border-zinc-800 flex flex-col min-h-0">
        <div className="shrink-0 px-3 pt-4 pb-3 border-b border-zinc-200/80 dark:border-zinc-800">
          <div className="flex items-baseline justify-between gap-2">
            <h1 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Inbox</h1>
            <span className="text-[11px] tabular-nums text-zinc-400">{items.length}</span>
          </div>
          <div className="mt-2 relative">
            <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search inbox"
              className="w-full h-8 pl-8 pr-3 rounded-lg bg-zinc-100 dark:bg-zinc-900 text-[12px] text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 outline-none focus:ring-2 focus:ring-zinc-300 dark:focus:ring-zinc-700"
            />
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          {loading && items.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
            </div>
          ) : error ? (
            <div className="px-4 py-10 text-center">
              <p className="text-sm text-zinc-700 dark:text-zinc-300">Couldn't load inbox</p>
              <p className="text-xs text-zinc-400 mt-1">{error}</p>
              <button
                type="button"
                onClick={() => void loadFiles()}
                className="mt-3 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:underline"
              >
                Try again
              </button>
            </div>
          ) : items.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <Inbox className="w-8 h-8 text-zinc-300 mx-auto mb-3" strokeWidth={1.5} />
              <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Inbox zero</p>
              <p className="text-xs text-zinc-400 mt-1">
                New uploads land here. You can decide where they belong later.
              </p>
            </div>
          ) : (
            <InboxList files={items} selectedId={selectedId} onSelect={selectAndKeep} />
          )}
        </div>
      </div>

      <div className="flex-1 min-w-0 min-h-0">
        <InboxReadingPane
          file={selected}
          onArchive={() => void handleArchive()}
          onMove={() => selected && setMoveTargets([selected])}
          onRename={() => selected && setRenameTarget(selected)}
          onTag={() => selected && openTagPicker([selected])}
          onStar={() => selected && void handleToggleStar(selected)}
          onHide={() => selected && void handleToggleHidden([selected])}
          onDelete={() => {
            if (!selected) return;
            selectNextAfter(selected.id);
            void handleTrashFiles([selected]);
          }}
        />
      </div>
    </div>
  );
}
