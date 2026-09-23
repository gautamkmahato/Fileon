"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  FolderPlus, Grid3x3, HardDrive, List, LogOut, Search, Upload,
} from "lucide-react";
import type { DriveFile } from "@/lib/drive/drive";
import { isFolder } from "@/lib/drive/drive";
import { getFileType } from "@/lib/types/file-types";
import { fuzzyFilter } from "@/lib/utils/fuzzy";
import { addRecentSearch, getRecentSearches } from "@/lib/utils/recent-searches";

export type PaletteActionId =
  | "new-folder"
  | "upload"
  | "toggle-view"
  | "sign-out";

export interface PaletteAction {
  id: PaletteActionId;
  label: string;
  subtitle: string;
  icon: React.ReactNode;
  keywords?: string;
}

export interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  files: DriveFile[];
  actions: PaletteAction[];
  onOpenFile: (file: DriveFile) => void;
  onRunAction: (id: PaletteActionId) => void;
}

type ResultItem =
  | { kind: "file"; file: DriveFile; group: "Folders" | "Files" }
  | { kind: "action"; action: PaletteAction; group: "Actions" }
  | { kind: "recent"; query: string; group: "Recent" };

export function CommandPalette({
  open, onClose, files, actions, onOpenFile, onRunAction,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setHighlight(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const results = useMemo((): ResultItem[] => {
    const q = query.trim();
    if (!q) {
      return getRecentSearches().map((s) => ({
        kind: "recent" as const,
        query: s,
        group: "Recent" as const,
      }));
    }

    const folders = fuzzyFilter(
      files.filter(isFolder),
      q,
      (f) => `${f.name} folder`
    ).map((file): ResultItem => ({ kind: "file", file, group: "Folders" }));

    const nonFolders = fuzzyFilter(
      files.filter((f) => !isFolder(f)),
      q,
      (f) => f.name
    ).map((file): ResultItem => ({ kind: "file", file, group: "Files" }));

    const matchedActions = fuzzyFilter(
      actions,
      q,
      (a) => `${a.label} ${a.subtitle} ${a.keywords || ""}`
    ).map((action): ResultItem => ({ kind: "action", action, group: "Actions" }));

    return [...folders, ...nonFolders, ...matchedActions];
  }, [query, files, actions]);

  useEffect(() => {
    setHighlight(0);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") { e.preventDefault(); onClose(); return; }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlight((h) => Math.min(h + 1, Math.max(0, results.length - 1)));
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlight((h) => Math.max(h - 1, 0));
      }
      if (e.key === "Enter" && results[highlight]) {
        e.preventDefault();
        execute(results[highlight]);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, results, highlight, onClose]);

  function execute(item: ResultItem) {
    if (item.kind === "recent") {
      setQuery(item.query);
      return;
    }
    if (item.kind === "file") {
      addRecentSearch(item.file.name);
      onOpenFile(item.file);
      onClose();
      return;
    }
    addRecentSearch(item.action.label);
    onRunAction(item.action.id);
    onClose();
  }

  if (!open) return null;

  let lastGroup = "";

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-[80] backdrop-blur-sm" onClick={onClose} />
      <div className="fixed left-1/2 top-[18%] -translate-x-1/2 w-full max-w-lg z-[81]">
        <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl border border-zinc-200 dark:border-zinc-700 overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-200 dark:border-zinc-700">
            <Search className="w-5 h-5 text-zinc-400 shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search files and actions…"
              className="flex-1 bg-transparent text-sm outline-none text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400"
            />
            <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500">esc</kbd>
          </div>
          <div className="max-h-80 overflow-y-auto py-2">
            {results.length === 0 && (
              <p className="px-4 py-6 text-sm text-zinc-500 text-center">No results</p>
            )}
            {results.map((item, i) => {
              const showHeader = item.group !== lastGroup;
              lastGroup = item.group;
              return (
                <div key={`${item.group}-${i}`}>
                  {showHeader && (
                    <p className="px-4 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                      {item.group}
                    </p>
                  )}
                  <button
                    onClick={() => execute(item)}
                    onMouseEnter={() => setHighlight(i)}
                    className={`w-full flex items-center gap-3 px-4 py-2 text-left text-sm transition-colors ${
                      highlight === i
                        ? "bg-blue-50 dark:bg-blue-950/50 text-blue-900 dark:text-blue-100"
                        : "text-zinc-800 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                    }`}
                  >
                    <ResultIcon item={item} />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">
                        {item.kind === "file" ? item.file.name
                          : item.kind === "action" ? item.action.label
                          : item.query}
                      </p>
                      <p className="text-xs text-zinc-500 truncate">
                        {item.kind === "file"
                          ? getFileType(item.file.mimeType).label
                          : item.kind === "action"
                          ? item.action.subtitle
                          : "Recent search"}
                      </p>
                    </div>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}

function ResultIcon({ item }: { item: ResultItem }) {
  if (item.kind === "action") {
    return <span className="w-8 h-8 flex items-center justify-center shrink-0">{item.action.icon}</span>;
  }
  if (item.kind === "recent") {
    return (
      <span className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
        <Search className="w-4 h-4 text-zinc-500" />
      </span>
    );
  }
  const type = getFileType(item.file.mimeType);
  const Icon = type.icon;
  return (
    <span className={`w-8 h-8 rounded-lg ${type.rowBg} flex items-center justify-center shrink-0`}>
      <Icon className={`w-4 h-4 ${type.rowTint}`} />
    </span>
  );
}

export function buildDefaultActions(view: "grid" | "list" | "gallery"): PaletteAction[] {
  return [
    {
      id: "new-folder",
      label: "New folder",
      subtitle: "Actions",
      icon: <FolderPlus className="w-4 h-4" />,
      keywords: "create folder",
    },
    {
      id: "upload",
      label: "Upload files",
      subtitle: "Actions",
      icon: <Upload className="w-4 h-4" />,
      keywords: "import add",
    },
    {
      id: "toggle-view",
      label: view === "list" ? "Switch to grid view" : "Switch to list view",
      subtitle: "Actions",
      icon: view === "list" ? <Grid3x3 className="w-4 h-4" /> : <List className="w-4 h-4" />,
      keywords: "view layout grid list gallery",
    },
    {
      id: "sign-out",
      label: "Sign out",
      subtitle: "Actions",
      icon: <LogOut className="w-4 h-4" />,
      keywords: "logout exit",
    },
  ];
}

export { HardDrive };
