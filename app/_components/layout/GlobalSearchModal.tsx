"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { type DriveFile, isFolder, searchFiles } from "@/lib/drive/drive";
import { getFileType } from "@/lib/types/file-types";
import { addRecentSearch, getRecentSearches } from "@/lib/utils/recent-searches";

const DEBOUNCE_MS = 300;

interface GlobalSearchModalProps {
  open: boolean;
  onClose: () => void;
  token: string | null;
  onOpenFile: (file: DriveFile) => void;
}

export function GlobalSearchModal({
  open, onClose, token, onOpenFile,
}: GlobalSearchModalProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextPageToken, setNextPageToken] = useState<string | undefined>();
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setResults([]);
    setNextPageToken(undefined);
    setHighlight(0);
    setLoading(false);
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  const runSearch = useCallback(async (q: string, pageToken?: string) => {
    if (!token || !q) return;
    const id = ++requestIdRef.current;
    if (pageToken) setLoadingMore(true);
    else setLoading(true);

    try {
      const res = await searchFiles({ token, query: q, pageToken });
      if (id !== requestIdRef.current) return;
      setResults((prev) => (pageToken ? [...prev, ...res.files] : res.files));
      setNextPageToken(res.nextPageToken);
    } catch (err) {
      console.error(err);
      if (id === requestIdRef.current && !pageToken) setResults([]);
    } finally {
      if (id === requestIdRef.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [token]);

  useEffect(() => {
    if (!open || !token) return;
    const q = query.trim();
    if (!q) {
      setResults([]);
      setNextPageToken(undefined);
      setLoading(false);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void runSearch(q);
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [open, token, query, runSearch]);

  useEffect(() => {
    setHighlight(0);
  }, [query, results.length]);

  const recentQueries = query.trim() ? [] : getRecentSearches();
  const flatItems: Array<{ kind: "recent"; query: string } | { kind: "file"; file: DriveFile }> = [
    ...recentQueries.map((q) => ({ kind: "recent" as const, query: q })),
    ...results.map((file) => ({ kind: "file" as const, file })),
  ];

  function openResult(file: DriveFile) {
    addRecentSearch(file.name);
    onOpenFile(file);
    onClose();
  }

  function selectItem(index: number) {
    const item = flatItems[index];
    if (!item) return;
    if (item.kind === "recent") {
      setQuery(item.query);
      return;
    }
    openResult(item.file);
  }

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlight((h) => Math.min(h + 1, Math.max(0, flatItems.length - 1)));
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlight((h) => Math.max(h - 1, 0));
      }
      if (e.key === "Enter" && flatItems[highlight]) {
        e.preventDefault();
        selectItem(highlight);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, flatItems, highlight, onClose]);

  if (!open) return null;

  const folders = results.filter(isFolder);
  const files = results.filter((f) => !isFolder(f));
  const trimmed = query.trim();

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-[80] backdrop-blur-sm" onClick={onClose} />
      <div className="fixed left-1/2 top-[12%] -translate-x-1/2 w-full max-w-lg z-[81]">
        <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl border border-zinc-200 dark:border-zinc-700 overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-200 dark:border-zinc-700">
            <Search className="w-5 h-5 text-zinc-400 shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search all of Google Drive…"
              className="flex-1 bg-transparent text-sm outline-none text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400"
            />
            {loading && <Loader2 className="w-4 h-4 animate-spin text-zinc-400 shrink-0" />}
            <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500">esc</kbd>
          </div>

          <div className="max-h-80 overflow-y-auto py-2">
            {!trimmed && recentQueries.length === 0 && (
              <p className="px-4 py-6 text-sm text-zinc-500 text-center">
                Search across your entire Google Drive
              </p>
            )}

            {!trimmed && recentQueries.length > 0 && (
              <>
                <p className="px-4 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                  Recent
                </p>
                {recentQueries.map((q, i) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => setQuery(q)}
                    onMouseEnter={() => setHighlight(i)}
                    className={`w-full flex items-center gap-3 px-4 py-2 text-left text-sm transition-colors ${
                      highlight === i
                        ? "bg-blue-50 dark:bg-blue-950/50 text-blue-900 dark:text-blue-100"
                        : "text-zinc-800 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                    }`}
                  >
                    <span className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
                      <Search className="w-4 h-4 text-zinc-500" />
                    </span>
                    <span className="truncate">{q}</span>
                  </button>
                ))}
              </>
            )}

            {trimmed && !loading && results.length === 0 && (
              <p className="px-4 py-6 text-sm text-zinc-500 text-center">No results in Google Drive</p>
            )}

            {trimmed && folders.length > 0 && (
              <>
                <p className="px-4 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                  Folders
                </p>
                {folders.map((file) => {
                  const index = flatItems.findIndex((item) => item.kind === "file" && item.file.id === file.id);
                  return (
                    <SearchResultRow
                      key={file.id}
                      file={file}
                      active={highlight === index}
                      onHover={() => setHighlight(index)}
                      onClick={() => openResult(file)}
                    />
                  );
                })}
              </>
            )}

            {trimmed && files.length > 0 && (
              <>
                <p className="px-4 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                  Files
                </p>
                {files.map((file) => {
                  const index = flatItems.findIndex((item) => item.kind === "file" && item.file.id === file.id);
                  return (
                    <SearchResultRow
                      key={file.id}
                      file={file}
                      active={highlight === index}
                      onHover={() => setHighlight(index)}
                      onClick={() => openResult(file)}
                    />
                  );
                })}
              </>
            )}

            {trimmed && nextPageToken && (
              <div className="px-4 py-2">
                <button
                  type="button"
                  disabled={loadingMore}
                  onClick={() => void runSearch(trimmed, nextPageToken)}
                  className="w-full py-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-lg disabled:opacity-50"
                >
                  {loadingMore ? "Loading…" : "Load more results"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function SearchResultRow({
  file, active, onHover, onClick,
}: {
  file: DriveFile;
  active: boolean;
  onHover: () => void;
  onClick: () => void;
}) {
  const type = getFileType(file.mimeType);
  const Icon = type.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={onHover}
      className={`w-full flex items-center gap-3 px-4 py-2 text-left text-sm transition-colors ${
        active
          ? "bg-blue-50 dark:bg-blue-950/50 text-blue-900 dark:text-blue-100"
          : "text-zinc-800 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800"
      }`}
    >
      <span className={`w-8 h-8 rounded-lg ${type.rowBg} flex items-center justify-center shrink-0`}>
        <Icon className={`w-4 h-4 ${type.rowTint}`} />
      </span>
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{file.name}</p>
        <p className="text-xs text-zinc-500 truncate">{type.label}</p>
      </div>
    </button>
  );
}
