"use client";

import {
  ArrowLeft, Bookmark, Eye, EyeOff, FolderPlus, Grid3x3, Images, List, Loader2,
  Pencil, RotateCcw, Tag, Trash2, Upload,
} from "lucide-react";
import { useBrowseStore, useFilesStore } from "@/lib/stores";
import { getSelectedDriveFiles, useSelectionActive, useSelectionCount } from "@/lib/stores";
import { Breadcrumb } from "../browse/Breadcrumb";
import { BrowseFilterBar } from "../browse/BrowseFilterBar";
import { ClipboardStatus } from "../../ui/ClipboardBar";
import { useDriveBrowse } from "../context/DriveBrowseProvider";
import { FileListBody } from "./FileListBody";
import { describeRule } from "@/lib/spaces";
import { humanFileSize } from "@/lib/drive/drive";
import { useSpaces } from "../../spaces/SpacesProvider";
import { driveRoutes } from "@/lib/navigation";
import { useRouter } from "next/navigation";
import type { ViewMode } from "@/lib/drive/types";

/** Toolbar + filters — uses browse context. Body uses stores for perf isolation. */
export function FileListView() {
  const b = useDriveBrowse();
  const selectionActive = useSelectionActive();
  const selectionCount = useSelectionCount();
  const revalidating = useFilesStore((s) => s.revalidating);
  const search = useBrowseStore((s) => s.search);
  const filters = useBrowseStore((s) => s.filters);
  const fileSort = useBrowseStore((s) => s.fileSort);
  const view = useBrowseStore((s) => s.view);
  const showHidden = useBrowseStore((s) => s.showHidden);
  const setSearch = useBrowseStore((s) => s.setSearch);
  const setFilters = useBrowseStore((s) => s.setFilters);
  const setFileSort = useBrowseStore((s) => s.setFileSort);
  const setView = useBrowseStore((s) => s.setView);
  const setShowHidden = useBrowseStore((s) => s.setShowHidden);
  const { openEdit, updateSpace, queryWarnings } = useSpaces();
  const router = useRouter();
  const space = b.activeSpace;
  const isSpace = b.isSpacesView && !!space;
  const spaceBytes = b.files.reduce((sum, f) => {
    const n = f.size ? Number(f.size) : 0;
    return sum + (Number.isFinite(n) ? n : 0);
  }, 0);

  const showTypeBreadcrumb = b.sidebarView === "type" && b.isTypeView;
  const showFolderBreadcrumb = b.isDriveScope && (b.sidebarView === "drive" || b.isSavedView);
  const showBreadcrumb = showTypeBreadcrumb || showFolderBreadcrumb;
  const showBackButton = showTypeBreadcrumb || (showFolderBreadcrumb && b.canGoBack) || isSpace;

  function setSpaceView(mode: ViewMode) {
    setView(mode);
    if (space) void updateSpace(space.id, { layout: mode });
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4 gap-3">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {showBackButton && (
            <button
              onClick={() => {
                if (isSpace) router.push(driveRoutes.spaces);
                else b.goBack();
              }}
              className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-colors bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
              aria-label="Back"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          {showBreadcrumb ? (
            <Breadcrumb crumbs={b.folderStack} onNavigate={b.navigateTo} />
          ) : (
            <div className="flex items-center gap-3 min-w-0">
              {isSpace && space.emoji && (
                <span className="text-xl leading-none shrink-0">{space.emoji}</span>
              )}
              <h1 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 truncate">{b.pageTitle}</h1>
              {isSpace && (
                <span className="text-xs text-zinc-500 shrink-0">
                  {b.files.length} file{b.files.length === 1 ? "" : "s"}
                  {spaceBytes > 0 ? ` · ${humanFileSize(spaceBytes)}` : ""}
                </span>
              )}
              {b.isTagsView && b.scopeTagIds.length > 1 && !b.isSavedView && (
                <div className="flex items-center gap-0.5 rounded-lg border border-zinc-200/80 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-0.5 shrink-0">
                  <button
                    onClick={() => b.setTagFilterMode("or")}
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      b.scopeTagMode === "or"
                        ? "bg-zinc-900 text-white"
                        : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    }`}
                  >
                    Any
                  </button>
                  <button
                    onClick={() => b.setTagFilterMode("and")}
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      b.scopeTagMode === "and"
                        ? "bg-zinc-900 text-white"
                        : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    }`}
                  >
                    All
                  </button>
                </div>
              )}
              {b.isTagsView && b.scopeTagIds.length > 1 && b.isSavedView && (
                <span className="text-xs text-zinc-500 shrink-0">
                  {b.scopeTagMode === "and" ? "All tags" : "Any tag"}
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <ClipboardStatus />
          {revalidating && (
            <Loader2 className="w-4 h-4 animate-spin text-zinc-400" aria-label="Refreshing" />
          )}
          {!b.isTrashView && !b.isActivityView && !b.isHiddenView && !b.isDashboardView && (
            <button
              onClick={() => setShowHidden(!showHidden)}
              className={`inline-flex items-center gap-1.5 text-sm font-medium px-3.5 py-2 rounded-lg border shadow-sm dark:shadow-none transition-colors ${
                showHidden
                  ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-zinc-900 dark:border-zinc-100"
                  : "bg-white dark:bg-zinc-900 border-zinc-200/80 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
              }`}
              title="Show items hidden in this app only"
            >
              {showHidden ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              Show hidden
            </button>
          )}
          {b.isViewSavable && (
            <button
              onClick={() => b.setSaveViewOpen(true)}
              className="inline-flex items-center gap-1.5 text-sm font-medium px-3.5 py-2 rounded-lg btn-primary shadow-sm"
              title="Save current filters, sort, and scope"
            >
              <Bookmark className="w-4 h-4" />
              Save view
            </button>
          )}
          {!b.isTrashView && !b.isActivityView && !b.isDashboardView && (
            <button
              onClick={() => b.setTagManageOpen(true)}
              className="inline-flex items-center gap-1.5 text-sm font-medium px-3.5 py-2 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 shadow-sm dark:shadow-none"
              title="Create, rename, and delete tags"
            >
              <Tag className="w-4 h-4" />
              Manage tags
            </button>
          )}
          {isSpace && space && (
            <button
              onClick={() => openEdit(space)}
              className="inline-flex items-center gap-1.5 text-sm font-medium px-3.5 py-2 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 shadow-sm dark:shadow-none"
              title="Edit rules and layout"
            >
              <Pencil className="w-4 h-4" />
              Edit space
            </button>
          )}
          {selectionActive && !b.isTrashView && (
            <button
              onClick={() => b.openTagPicker(getSelectedDriveFiles())}
              className="inline-flex items-center gap-1.5 text-sm font-medium px-3.5 py-2 rounded-lg btn-primary shadow-sm"
            >
              <Tag className="w-4 h-4" />
              Tag{selectionCount > 1 ? ` (${selectionCount})` : ""}
            </button>
          )}
          {!b.isTrashView && (b.sidebarView === "drive" || b.sidebarView === "dashboard") && !b.isTagsView && (
            <>
              <label className={`inline-flex items-center gap-1.5 text-sm font-medium px-3.5 py-2 rounded-lg btn-primary border border-zinc-900 dark:border-zinc-700 shadow-sm dark:shadow-none ${b.uploading ? "opacity-60 pointer-events-none" : "cursor-pointer"}`}>
                {b.uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {b.uploading ? "Uploading…" : "Upload"}
                <input
                  ref={b.uploadInputRef}
                  type="file"
                  className="hidden"
                  multiple
                  onChange={(e) => { b.handleUpload(e.target.files); e.target.value = ""; }}
                />
              </label>
              <button
                onClick={() => b.setShowNewFolder(true)}
                className="inline-flex items-center gap-1.5 text-sm font-medium px-3.5 py-2 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 shadow-sm dark:shadow-none"
              >
                <FolderPlus className="w-4 h-4" />
                New folder
              </button>
            </>
          )}
          {b.isTrashView && b.files.length > 0 && (
            <button
              onClick={() => b.setEmptyTrashConfirm(true)}
              className="inline-flex items-center gap-1.5 text-sm font-medium px-3.5 py-2 rounded-lg border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
            >
              <Trash2 className="w-4 h-4" />
              Empty trash
            </button>
          )}
          {b.isTrashView && selectionCount > 0 && (
            <button
              onClick={() => b.handleRestoreFiles(getSelectedDriveFiles())}
              className="inline-flex items-center gap-1.5 text-sm font-medium px-3.5 py-2 rounded-lg btn-primary"
            >
              <RotateCcw className="w-4 h-4" />
              Restore
            </button>
          )}
          <div className="flex items-center gap-0.5 rounded-lg border border-zinc-200/80 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-0.5 ml-1 shadow-sm dark:shadow-none">
            <button
              onClick={() => isSpace ? setSpaceView("grid") : setView("grid")}
              className={`w-8 h-8 rounded-md flex items-center justify-center ${
                view === "grid" ? "bg-zinc-900 text-white" : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              }`}
              aria-label="Grid view"
            >
              <Grid3x3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => isSpace ? setSpaceView("list") : setView("list")}
              className={`w-8 h-8 rounded-md flex items-center justify-center ${
                view === "list" ? "bg-zinc-900 text-white" : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              }`}
              aria-label="List view"
            >
              <List className="w-4 h-4" />
            </button>
            {isSpace && (
              <button
                onClick={() => setSpaceView("gallery")}
                className={`w-8 h-8 rounded-md flex items-center justify-center ${
                  view === "gallery" ? "bg-zinc-900 text-white" : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                }`}
                aria-label="Gallery view"
              >
                <Images className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {isSpace && space && space.rules.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {space.rules.map((rule) => (
            <span
              key={rule.id}
              className="text-[11px] px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300"
            >
              {describeRule(rule, b.tags)}
            </span>
          ))}
          <span className="text-[11px] px-2 py-0.5 text-zinc-400">
            {space.matchMode === "and" ? "All rules" : "Any rule"} · files stay in Drive
          </span>
        </div>
      )}
      {isSpace && queryWarnings.length > 0 && (
        <div className="mb-3 px-4 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-sm text-amber-800 dark:text-amber-200">
          {queryWarnings[0]}
        </div>
      )}
      {isSpace && space?.cachedTruncated && (
        <div className="mb-3 px-4 py-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 text-sm text-zinc-600 dark:text-zinc-300">
          Showing the first matches. Narrow the rules if you need a smaller set.
        </div>
      )}

      <BrowseFilterBar
        search={search}
        onSearchChange={setSearch}
        filters={filters}
        onFiltersChange={setFilters}
        fileSort={fileSort}
        onSortChange={(sort) => {
          setFileSort(sort);
          if (space) void updateSpace(space.id, { sortField: sort.field, sortDir: sort.dir });
        }}
        isTrashView={b.isTrashView}
      />

      <FileListBody loadFiles={b.loadFiles} loadMore={b.loadMore} />
    </>
  );
}
