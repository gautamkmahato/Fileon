"use client";

import { memo } from "react";
import { Loader2 } from "lucide-react";
import { isFolder } from "@/lib/drive/drive";
import { DEFAULT_FILTERS } from "@/lib/utils/filter";
import { driveActions } from "@/lib/drive/drive-actions-bridge";
import { useDriveRoute } from "@/lib/drive/useDriveRoute";
import { useBrowseStore, useFilesStore } from "@/lib/stores";
import { FileCard } from "../items/FileCard";
import { FileRow } from "../items/FileRow";
import { FolderCard } from "../items/FolderCard";
import {
  EmptyState, ErrorState, InlineLoadingSpinner, LoadingState, NoMatchState,
} from "../browse/ViewStates";
import { useVisibleDriveItems } from "../hooks/useVisibleDriveItems";
import { useHidden } from "../../hidden/HiddenProvider";
import { useFavorites } from "../../favorites/FavoritesProvider";
import { PinnedSection } from "../browse/PinnedSection";
import { TypeBrowseStrip } from "../browse/TypeBrowseStrip";
import { TYPE_BROWSE_META } from "@/lib/drive/type-browse";

/** File grid/list — store subscriptions only; immune to modal/context churn. */
export const FileListBody = memo(function FileListBody({
  loadFiles,
  loadMore,
}: {
  loadFiles: () => Promise<void>;
  loadMore: () => Promise<void>;
}) {
  const {
    isTrashView, isTagsView, isSavedView, activeSavedView, scopeTagIds,
    isTypeView, typeCategory, isSpacesView, activeSpace, spacesLoading,
  } = useDriveRoute();
  const { isHidden: checkHidden } = useHidden();
  const { isFavorite: checkFavorite } = useFavorites();
  const loading = useFilesStore((s) => s.loading);
  const error = useFilesStore((s) => s.error);
  const loadingMore = useFilesStore((s) => s.loadingMore);
  const nextPageToken = useFilesStore((s) => s.nextPageToken);
  const view = useBrowseStore((s) => s.view);
  const folderDropTarget = useBrowseStore((s) => s.folderDropTarget);
  const setSearch = useBrowseStore((s) => s.setSearch);
  const setFilters = useBrowseStore((s) => s.setFilters);

  const {
    pinnedItems, pinFolderKey, visibleFolders, myDriveFolders, visibleFiles,
    hasAnyVisible, isDashboardView, isHiddenView, isFiltering, files, showHidden,
  } = useVisibleDriveItems();

  const showAsHidden = (id: string) => isHiddenView || (showHidden && checkHidden(id));
  const hiddenItems = [...myDriveFolders, ...visibleFiles];

  if ((isSavedView && !activeSavedView) || (isSpacesView && spacesLoading && !activeSpace) || (loading && files.length === 0)) {
    return <LoadingState />;
  }
  if (error) {
    return <ErrorState error={error} onRetry={loadFiles} />;
  }
  if (isTagsView && scopeTagIds.length === 0) {
    return <EmptyState label="Select a tag from the sidebar" />;
  }
  if (isSpacesView && activeSpace && activeSpace.rules.length === 0) {
    return <EmptyState label="Add a rule to collect matching files" />;
  }
  if (files.length === 0) {
    const typeEmpty = isTypeView && typeCategory ? TYPE_BROWSE_META[typeCategory].emptyLabel : null;
    return (
      <EmptyState label={
        isTrashView ? "Trash is empty"
        : isTagsView ? "No files with these tags"
        : isHiddenView ? "No hidden items"
        : isSpacesView ? "No files match these rules"
        : typeEmpty ?? "This folder is empty"
      } />
    );
  }
  if (!hasAnyVisible && !(isDashboardView && files.length > 0 && !isFiltering)) {
    return (
      <NoMatchState onClear={() => { setFilters(DEFAULT_FILTERS); setSearch(""); }} />
    );
  }

  const showFilesSection = visibleFiles.length > 0 || isDashboardView;
  const filesSectionTitle = isDashboardView ? "Recent files" : "Files";
  const fileGridClass = view === "gallery"
    ? "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4"
    : "grid grid-cols-2 sm:grid-cols-4 gap-3";
  const dashGridClass = view === "gallery"
    ? "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4"
    : "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4";

  const renderFolderCard = (folder: typeof myDriveFolders[number], i: number) => (
    <FolderCard
      key={folder.id}
      folder={folder}
      tintIndex={i}
      isFavorite={checkFavorite(folder.id)}
      isHidden={showAsHidden(folder.id)}
      isDropTarget={folderDropTarget === folder.id}
      onOpen={driveActions.openFile}
      onSelect={driveActions.handleItemSelect}
      onMenu={!isTrashView ? driveActions.openMenu : undefined}
      onDragStart={driveActions.onItemDragStart}
      onDragOver={(e) => driveActions.onFolderDragOver(e, folder.id)}
      onDragLeave={driveActions.onFolderDragLeave}
      onDrop={(e) => driveActions.onFolderDrop(e, folder.id)}
    />
  );

  const renderFileCard = (file: typeof visibleFiles[number]) => (
    <FileCard
      key={file.id}
      file={file}
      isHidden={showAsHidden(file.id)}
      onOpen={driveActions.openFile}
      onSelect={driveActions.handleItemSelect}
      onToggleStar={!isTrashView ? driveActions.handleToggleStar : undefined}
      onMenu={!isTrashView ? driveActions.openMenu : undefined}
      onDragStart={isTrashView ? undefined : driveActions.onItemDragStart}
      isTrash={isTrashView}
      onRestore={isTrashView ? driveActions.handleRestoreOne : undefined}
      onDeleteForever={isTrashView ? driveActions.setDeleteForeverOne : undefined}
    />
  );

  const renderFileRow = (file: typeof visibleFiles[number]) => (
    <FileRow
      key={file.id}
      file={file}
      isHidden={showAsHidden(file.id)}
      onOpen={driveActions.openFile}
      onSelect={driveActions.handleItemSelect}
      onMenu={!isTrashView ? driveActions.openMenu : undefined}
      onDragStart={isTrashView ? undefined : driveActions.onItemDragStart}
      isTrash={isTrashView}
      onRestore={isTrashView ? driveActions.handleRestoreOne : undefined}
      onDeleteForever={isTrashView ? driveActions.setDeleteForeverOne : undefined}
    />
  );

  return (
    <>
      {(isHiddenView || showHidden) && !isTrashView && (
        <div className="mb-6 px-4 py-3 rounded-xl bg-zinc-100 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 text-sm text-zinc-600 dark:text-zinc-300">
          Hidden items remain visible in Google Drive itself. This is a local view filter only — not a privacy or security control.
        </div>
      )}
      {isTrashView && (
        <div className="mb-6 px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-sm text-amber-800 dark:text-amber-200">
          Items in trash are deleted forever after 30 days.
        </div>
      )}
      {isDashboardView && <TypeBrowseStrip />}
      {isDashboardView && visibleFolders.length > 0 && (
        <section className="mb-10">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-3">Folders</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {visibleFolders.map((folder, i) => renderFolderCard(folder, i))}
          </div>
        </section>
      )}
      {isDashboardView && pinFolderKey && pinnedItems.length > 0 && (
        <PinnedSection
          folderKey={pinFolderKey}
          items={pinnedItems}
          isTrashView={isTrashView}
          folderDropTarget={folderDropTarget}
        />
      )}
      {isDashboardView && showFilesSection && (
        <section>
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-3">{filesSectionTitle}</h2>
          {visibleFiles.length > 0 ? (
            view !== "list" ? (
              <div className={dashGridClass}>
                {visibleFiles.map(renderFileCard)}
              </div>
            ) : (
              <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200/80 dark:border-zinc-700 overflow-hidden shadow-sm dark:shadow-none">
                <div className="grid grid-cols-[1fr_180px_160px_120px_40px] gap-4 px-5 py-2.5 border-b border-zinc-200 dark:border-zinc-700 text-[11px] uppercase tracking-wider font-medium text-zinc-500 bg-zinc-50/40 dark:bg-zinc-800/40">
                  <span className="pl-7">Name</span>
                  <span>Owner</span>
                  <span>Modified</span>
                  <span>Size</span>
                  <span />
                </div>
                {visibleFiles.map(renderFileRow)}
              </div>
            )
          ) : (
            <p className="text-sm text-zinc-500 dark:text-zinc-400 py-6">
              No files modified in the last month.
            </p>
          )}
        </section>
      )}
      {!isDashboardView && !isHiddenView && myDriveFolders.length > 0 && (
        <section className="mb-10">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-3">Folders</h2>
          {view !== "list" ? (
            <div className={fileGridClass}>
              {myDriveFolders.map((folder, i) => renderFolderCard(folder, i))}
            </div>
          ) : (
            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200/80 dark:border-zinc-700 overflow-hidden shadow-sm dark:shadow-none">
              <div className="grid grid-cols-[1fr_180px_160px_120px_40px] gap-4 px-5 py-2.5 border-b border-zinc-200 dark:border-zinc-700 text-[11px] uppercase tracking-wider font-medium text-zinc-500 bg-zinc-50/40 dark:bg-zinc-800/40">
                <span className="pl-7">Name</span>
                <span>Owner</span>
                <span>Modified</span>
                <span>Size</span>
                <span />
              </div>
              {myDriveFolders.map((item) => (
                <FileRow
                  key={item.id}
                  file={item}
                  onOpen={driveActions.openFile}
                  onSelect={driveActions.handleItemSelect}
                  onMenu={!isTrashView ? driveActions.openMenu : undefined}
                  onDragStart={isTrashView ? undefined : driveActions.onItemDragStart}
                />
              ))}
            </div>
          )}
        </section>
      )}
      {!isDashboardView && !isHiddenView && visibleFiles.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-3">Files</h2>
          {view !== "list" ? (
            <div className={fileGridClass}>
              {visibleFiles.map(renderFileCard)}
            </div>
          ) : (
            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200/80 dark:border-zinc-700 overflow-hidden shadow-sm dark:shadow-none">
              <div className="grid grid-cols-[1fr_180px_160px_120px_40px] gap-4 px-5 py-2.5 border-b border-zinc-200 dark:border-zinc-700 text-[11px] uppercase tracking-wider font-medium text-zinc-500 bg-zinc-50/40 dark:bg-zinc-800/40">
                <span className="pl-7">Name</span>
                <span>Owner</span>
                <span>Modified</span>
                <span>Size</span>
                <span />
              </div>
              {visibleFiles.map(renderFileRow)}
            </div>
          )}
        </section>
      )}
      {isHiddenView && hiddenItems.length > 0 && (
        <section>
          {view !== "list" ? (
            <div className={fileGridClass}>
              {hiddenItems.map((item, i) =>
                isFolder(item) ? renderFolderCard(item, i) : renderFileCard(item)
              )}
            </div>
          ) : (
            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200/80 dark:border-zinc-700 overflow-hidden shadow-sm dark:shadow-none">
              <div className="grid grid-cols-[1fr_180px_160px_120px_40px] gap-4 px-5 py-2.5 border-b border-zinc-200 dark:border-zinc-700 text-[11px] uppercase tracking-wider font-medium text-zinc-500 bg-zinc-50/40 dark:bg-zinc-800/40">
                <span className="pl-7">Name</span>
                <span>Owner</span>
                <span>Modified</span>
                <span>Size</span>
                <span />
              </div>
              {hiddenItems.map((item) =>
                isFolder(item) ? (
                  <FileRow
                    key={item.id}
                    file={item}
                    isHidden
                    onOpen={driveActions.openFile}
                    onSelect={driveActions.handleItemSelect}
                    onMenu={driveActions.openMenu}
                  />
                ) : renderFileRow(item)
              )}
            </div>
          )}
        </section>
      )}
      {nextPageToken && !loading && !isSpacesView && (
        <div className="mt-6 flex justify-center">
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-60"
          >
            {loadingMore && <Loader2 className="w-4 h-4 animate-spin" />}
            {loadingMore ? "Loading…" : "Load more"}
          </button>
        </div>
      )}
      {loading && files.length > 0 && !loadingMore && <InlineLoadingSpinner />}
    </>
  );
});
