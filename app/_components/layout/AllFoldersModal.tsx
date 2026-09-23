"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, Folder, Loader2, Search, X } from "lucide-react";
import type { DriveFile } from "@/lib/drive/drive";
import {
  type FolderChildRef,
  getFolderChildrenCacheEntry,
  hasFolderChildrenCache,
  loadFolderChildren,
  normalizeParentCacheKey,
  searchFoldersCached,
  subscribeFolderTreeInvalidation,
} from "@/lib/cache/folder-children-cache";
import { driveRoutes } from "@/lib/navigation";

interface TreeNode {
  folder: DriveFile;
  children: TreeNode[];
  expanded: boolean;
  loaded: boolean;
  loading: boolean;
}

interface AllFoldersModalProps {
  open: boolean;
  token: string | null;
  onClose: () => void;
}

function folderToNode(folder: FolderChildRef): TreeNode {
  return {
    folder: folder as DriveFile,
    children: [],
    expanded: false,
    loaded: false,
    loading: false,
  };
}

function foldersToNodes(folders: FolderChildRef[]): TreeNode[] {
  return folders.map(folderToNode);
}

function mergeRootNodes(prev: TreeNode[], folders: FolderChildRef[]): TreeNode[] {
  const prevById = new Map(prev.map((n) => [n.folder.id, n]));
  return folders.map((f) => {
    const existing = prevById.get(f.id);
    if (existing) return { ...existing, folder: f as DriveFile };
    return folderToNode(f);
  });
}

function removeNodesFromTree(nodes: TreeNode[], ids: Set<string>): TreeNode[] {
  return nodes
    .filter((n) => !ids.has(n.folder.id))
    .map((n) => ({ ...n, children: removeNodesFromTree(n.children, ids) }));
}

function patchFolderNames(
  nodes: TreeNode[],
  renames: { id: string; name: string }[],
): TreeNode[] {
  const map = new Map(renames.map((r) => [r.id, r.name]));
  return nodes.map((n) => {
    const newName = map.get(n.folder.id);
    const folder = newName ? { ...n.folder, name: newName } : n.folder;
    return { ...n, folder, children: patchFolderNames(n.children, renames) };
  });
}

function countNodes(nodes: TreeNode[]): number {
  return nodes.reduce((sum, n) => sum + 1 + countNodes(n.children), 0);
}

function filterTree(nodes: TreeNode[], query: string): TreeNode[] {
  const lower = query.toLowerCase();
  const out: TreeNode[] = [];
  for (const node of nodes) {
    const childMatches = filterTree(node.children, query);
    const selfMatch = node.folder.name.toLowerCase().includes(lower);
    if (selfMatch || childMatches.length > 0) {
      out.push({
        ...node,
        expanded: true,
        children: childMatches.length > 0 ? childMatches : node.children,
      });
    }
  }
  return out;
}

export function AllFoldersModal({ open, token, onClose }: AllFoldersModalProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [loadingRoots, setLoadingRoots] = useState(false);
  const [searchResults, setSearchResults] = useState<FolderChildRef[]>([]);
  const [searching, setSearching] = useState(false);
  const treeRef = useRef(tree);
  treeRef.current = tree;

  useEffect(() => {
    if (!open) {
      setSearch("");
      setSearchResults([]);
    }
  }, [open]);

  useEffect(() => {
    if (!token) {
      setTree([]);
      setSearchResults([]);
    }
  }, [token]);

  useEffect(() => {
    if (!open || !token) return;

    const cached = getFolderChildrenCacheEntry(null);
    const hasTree = treeRef.current.length > 0;

    if (!hasTree && cached) {
      setTree(foldersToNodes(cached.folders));
    }

    setLoadingRoots(!hasTree && !cached);

    loadFolderChildren(token, null)
      .then(({ folders }) => {
        setTree((prev) => (prev.length ? mergeRootNodes(prev, folders) : foldersToNodes(folders)));
      })
      .catch(console.error)
      .finally(() => setLoadingRoots(false));
  }, [open, token]);

  useEffect(() => {
    if (!open || !token) return;

    return subscribeFolderTreeInvalidation((event) => {
      setTree((prev) => {
        let next = prev;
        if (event.removedFolderIds?.length) {
          next = removeNodesFromTree(next, new Set(event.removedFolderIds));
        }
        if (event.renamed?.length) {
          next = patchFolderNames(next, event.renamed);
        }
        return next;
      });

      if (!event.invalidateParents?.length) return;

      for (const parentId of event.invalidateParents) {
        const key = normalizeParentCacheKey(parentId);
        if (key === "root") {
          void loadFolderChildren(token, null, { force: true })
            .then(({ folders }) => {
              setTree((prev) => mergeRootNodes(prev, folders));
            })
            .catch(console.error);
          continue;
        }

        setTree((prev) => {
          const node = findNode(prev, key);
          if (!node) return prev;
          if (node.expanded && node.loaded) {
            void loadFolderChildren(token, key, { force: true })
              .then(({ folders }) => {
                setTree((cur) =>
                  patchNode(cur, key, {
                    children: foldersToNodes(folders),
                    loaded: true,
                    loading: false,
                  }),
                );
              })
              .catch(console.error);
            return patchNode(prev, key, { loading: true });
          }
          return patchNode(prev, key, { loaded: false, children: [], loading: false });
        });
      }
    });
  }, [open, token]);

  useEffect(() => {
    if (!open || !token) return;
    const q = search.trim();
    if (!q) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const timer = setTimeout(() => {
      searchFoldersCached(token, q)
        .then(setSearchResults)
        .catch(console.error)
        .finally(() => setSearching(false));
    }, 250);
    return () => clearTimeout(timer);
  }, [open, token, search]);

  const toggleExpand = useCallback(
    (nodeId: string) => {
      if (!token) return;

      setTree((prev) => {
        const target = findNode(prev, nodeId);
        if (!target) return prev;

        if (target.loaded) {
          return patchNode(prev, nodeId, { expanded: !target.expanded });
        }

        const cached = hasFolderChildrenCache(nodeId);
        if (cached) {
          const entry = getFolderChildrenCacheEntry(nodeId);
          if (entry) {
            void loadFolderChildren(token, nodeId).then(({ folders }) => {
              setTree((current) =>
                patchNode(current, nodeId, {
                  children: foldersToNodes(folders),
                  loaded: true,
                  loading: false,
                  expanded: true,
                }),
              );
            });
            return patchNode(prev, nodeId, {
              children: foldersToNodes(entry.folders),
              loaded: true,
              loading: false,
              expanded: true,
            });
          }
        }

        void loadFolderChildren(token, nodeId)
          .then(({ folders }) => {
            setTree((current) =>
              patchNode(current, nodeId, {
                children: foldersToNodes(folders),
                loaded: true,
                loading: false,
                expanded: true,
              }),
            );
          })
          .catch((err) => {
            console.error(err);
            setTree((current) =>
              patchNode(current, nodeId, { loading: false, expanded: false }),
            );
          });

        return patchNode(prev, nodeId, { loading: true, expanded: true });
      });
    },
    [token],
  );

  const trimmedSearch = search.trim();
  const isSearchMode = trimmedSearch.length > 0;
  const displayTree = useMemo(
    () => (isSearchMode ? filterTree(tree, trimmedSearch) : tree),
    [tree, trimmedSearch, isSearchMode],
  );
  const visibleCount = isSearchMode ? searchResults.length : countNodes(displayTree);
  const showFullLoader =
    (loadingRoots && tree.length === 0) || (searching && isSearchMode && searchResults.length === 0);

  function navigateToFolder(folderId: string) {
    router.push(driveRoutes.folder(folderId));
    onClose();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-20 px-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative w-full max-w-xl bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200/80 dark:border-zinc-700 overflow-hidden flex flex-col max-h-[70vh]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="all-folders-title"
      >
        <div className="px-5 py-4 border-b border-zinc-200 dark:border-zinc-700 flex items-center gap-3 shrink-0">
          <Folder className="w-5 h-5 text-zinc-500" strokeWidth={1.75} />
          <h2 id="all-folders-title" className="text-base font-semibold text-zinc-900 dark:text-zinc-100 flex-1">
            All folders
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center text-zinc-500"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-3 border-b border-zinc-200 dark:border-zinc-700 shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search folders…"
              className="w-full h-10 pl-10 pr-3 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm text-zinc-900 dark:text-zinc-100 outline-none focus:bg-white dark:focus:bg-zinc-900 focus:border-zinc-400 dark:focus:border-zinc-500"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 min-h-0">
          {showFullLoader ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
            </div>
          ) : isSearchMode ? (
            searchResults.length === 0 ? (
              <div className="text-center py-12 text-sm text-zinc-500">
                No folders match &ldquo;{trimmedSearch}&rdquo;
              </div>
            ) : (
              <ul className="space-y-0.5">
                {searchResults.map((folder) => (
                  <li key={folder.id}>
                    <button
                      type="button"
                      onClick={() => navigateToFolder(folder.id)}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-left"
                    >
                      <span className="w-4 h-4 shrink-0" />
                      <Folder className="w-4 h-4 shrink-0 text-zinc-500" strokeWidth={1.75} />
                      <span className="truncate flex-1">{folder.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )
          ) : displayTree.length === 0 ? (
            <div className="text-center py-12 text-sm text-zinc-500">No folders found</div>
          ) : (
            <ul className="space-y-0.5">
              {displayTree.map((node) => (
                <FolderTreeRow
                  key={node.folder.id}
                  node={node}
                  depth={0}
                  onToggle={toggleExpand}
                  onNavigate={navigateToFolder}
                />
              ))}
            </ul>
          )}
        </div>

        <div className="px-5 py-3 border-t border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-800/30 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-zinc-500">
            {visibleCount} folder{visibleCount === 1 ? "" : "s"}
          </span>
          <span className="text-[11px] text-zinc-400">Click any folder to navigate</span>
        </div>
      </div>
    </div>
  );
}

function FolderTreeRow({
  node, depth, onToggle, onNavigate,
}: {
  node: TreeNode;
  depth: number;
  onToggle: (id: string) => void;
  onNavigate: (id: string) => void;
}) {
  const hasChildren = node.loaded ? node.children.length > 0 : true;
  const showChildren = node.expanded && node.children.length > 0;

  return (
    <>
      <li>
        <div
          className="group flex items-center gap-1.5 pr-3 py-1.5 rounded-lg text-[13px] hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
          style={{ paddingLeft: `${8 + depth * 16}px` }}
          onClick={() => onNavigate(node.folder.id)}
          onKeyDown={(e) => { if (e.key === "Enter") onNavigate(node.folder.id); }}
          role="button"
          tabIndex={0}
        >
          {hasChildren ? (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onToggle(node.folder.id); }}
              className="w-4 h-4 flex items-center justify-center shrink-0 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
              aria-label={node.expanded ? "Collapse" : "Expand"}
            >
              {node.loading ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : node.expanded ? (
                <ChevronDown className="w-3.5 h-3.5" strokeWidth={2.25} />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" strokeWidth={2.25} />
              )}
            </button>
          ) : (
            <span className="w-4 h-4 shrink-0" />
          )}
          <Folder className="w-4 h-4 shrink-0 text-zinc-500" strokeWidth={1.75} />
          <span className="truncate flex-1 text-zinc-700 dark:text-zinc-300">{node.folder.name}</span>
        </div>
      </li>
      {showChildren && node.children.map((child) => (
        <FolderTreeRow
          key={child.folder.id}
          node={child}
          depth={depth + 1}
          onToggle={onToggle}
          onNavigate={onNavigate}
        />
      ))}
    </>
  );
}

function findNode(nodes: TreeNode[], id: string): TreeNode | null {
  for (const n of nodes) {
    if (n.folder.id === id) return n;
    const found = findNode(n.children, id);
    if (found) return found;
  }
  return null;
}

function patchNode(nodes: TreeNode[], id: string, patch: Partial<TreeNode>): TreeNode[] {
  return nodes.map((n) => {
    if (n.folder.id === id) return { ...n, ...patch };
    if (n.children.length) return { ...n, children: patchNode(n.children, id, patch) };
    return n;
  });
}
