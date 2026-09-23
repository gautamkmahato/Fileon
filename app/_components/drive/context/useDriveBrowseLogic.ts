"use client";

import { useCallback, useMemo, useRef } from "react";
import { useDriveRoute } from "@/lib/drive/useDriveRoute";
import { useAuth } from "../../auth/AuthProvider";
import { useTags } from "../../tags/TagsProvider";
import { buildSelectionScopeKey, useBrowseStore, useSelectionStore } from "@/lib/stores";
import { syncDriveActionHandlers } from "@/lib/drive/drive-actions-bridge";
import { useDriveFiles } from "./useDriveFiles";
import { useDriveActions } from "./useDriveActions";
import { useDriveKeyboard } from "./useDriveKeyboard";

/** Composes file loading, actions, and keyboard hooks into the browse context value. */
export function useDriveBrowseLogic() {
  const { token, profile, signOut } = useAuth();
  const routeState = useDriveRoute();
  const { tags, counts, tagsByFileId } = useTags();

  const { sidebarView, routeFolderId, routeTagIdsKey, savedViewId, typeCategory, cleanupKind } = routeState;

  const scopeKey = useMemo(
    () => buildSelectionScopeKey({
      sidebarView, routeFolderId, routeTagIdsKey, savedViewId, typeCategory, cleanupKind,
      spaceId: routeState.routeSpaceId,
    }),
    [sidebarView, routeFolderId, routeTagIdsKey, savedViewId, typeCategory, cleanupKind, routeState.routeSpaceId],
  );

  const clearSelection = useCallback(() => {
    useSelectionStore.getState().clearSelection();
  }, []);

  const onClearPreviewRef = useRef<() => void>(() => {});

  const filesCtx = useDriveFiles({
    token,
    routeState,
    tags,
    tagsByFileId,
    scopeKey,
    clearSelection,
    onClearPreview: () => onClearPreviewRef.current(),
  });

  const actions = useDriveActions({
    token,
    signOut,
    routeState,
    filesCtx,
    clearSelection,
  });

  onClearPreviewRef.current = () => actions.setPreviewFile(null);

  syncDriveActionHandlers({
    openFile: actions.openFile,
    openQuickLook: actions.openQuickLook,
    handleItemSelect: actions.handleItemSelect,
    openMenu: actions.openMenu,
    handleToggleStar: actions.handleToggleStar,
    handleRestoreFiles: actions.handleRestoreFiles,
    setDeleteForeverTargets: actions.setDeleteForeverTargets,
    onItemDragStart: actions.dragDrop.onItemDragStart,
    onFolderDragOver: actions.dragDrop.onFolderDragOver,
    onFolderDrop: actions.dragDrop.onFolderDrop,
    setFolderDropTarget: (id) => useBrowseStore.getState().setFolderDropTarget(id),
  });

  useDriveKeyboard({
    quickLookFile: actions.quickLookFile,
    previewFile: actions.previewFile,
    paletteOpen: actions.paletteOpen,
    setPaletteOpen: actions.setPaletteOpen,
    globalSearchOpen: actions.globalSearchOpen,
    setGlobalSearchOpen: actions.setGlobalSearchOpen,
    shortcutsOpen: actions.shortcutsOpen,
    setShortcutsOpen: actions.setShortcutsOpen,
    setPreviewFile: actions.setPreviewFile,
    clearSelection,
    openQuickLook: actions.openQuickLook,
    visibleFilesRef: filesCtx.visibleFilesRef,
    visibleIdsRef: filesCtx.visibleIdsRef,
    isBlockingModalOpen: actions.isBlockingModalOpen,
    canUndo: actions.canUndo,
    executeUndo: actions.executeUndo,
    handleTogglePin: () => { void actions.handleTogglePin(); },
    handleCut: actions.handleCut,
    handleCopy: actions.handleCopy,
    handlePaste: () => { void actions.handlePaste(); },
    handleCancelClipboard: actions.handleCancelClipboard,
  });

  const search = useBrowseStore((s) => s.search);
  const filters = useBrowseStore((s) => s.filters);
  const fileSort = useBrowseStore((s) => s.fileSort);
  const view = useBrowseStore((s) => s.view);
  const setSearch = useBrowseStore((s) => s.setSearch);
  const setFilters = useBrowseStore((s) => s.setFilters);
  const setFileSort = useBrowseStore((s) => s.setFileSort);
  const setView = useBrowseStore((s) => s.setView);

  return {
    ...routeState,
    token, profile, signOut,
    folderStack: filesCtx.folderStack,
    currentFolder: filesCtx.currentFolder,
    canGoBack: filesCtx.canGoBack,
    folderContext: filesCtx.folderContext,
    files: filesCtx.files,
    loading: filesCtx.loading,
    error: filesCtx.error,
    loadingMore: filesCtx.loadingMore,
    nextPageToken: filesCtx.nextPageToken,
    loadFiles: filesCtx.loadFiles,
    loadMore: filesCtx.loadMore,
    view, setView, search, setSearch, filters, setFilters, fileSort, setFileSort,
    visibleFolders: filesCtx.visibleFolders,
    visibleFiles: filesCtx.visibleFiles,
    hasAnyVisible: filesCtx.hasAnyVisible,
    isFiltering: filesCtx.isFiltering,
    isViewSavable: filesCtx.isViewSavable,
    pageTitle: filesCtx.pageTitle,
    clearSelection,
    handleItemSelect: actions.handleItemSelect,
    previewFile: actions.previewFile,
    setPreviewFile: actions.setPreviewFile,
    quickLookFile: actions.quickLookFile,
    openQuickLook: actions.openQuickLook,
    closeQuickLook: actions.closeQuickLook,
    handleQuickLookNavigate: actions.handleQuickLookNavigate,
    quota: filesCtx.quota,
    sidebarCollapsed: actions.sidebarCollapsed,
    setSidebarCollapsed: actions.setSidebarCollapsed,
    uploading: actions.uploading,
    uploadLabel: actions.uploadLabel,
    uploadInputRef: actions.uploadInputRef,
    paletteOpen: actions.paletteOpen,
    setPaletteOpen: actions.setPaletteOpen,
    globalSearchOpen: actions.globalSearchOpen,
    setGlobalSearchOpen: actions.setGlobalSearchOpen,
    shortcutsOpen: actions.shortcutsOpen,
    setShortcutsOpen: actions.setShortcutsOpen,
    paletteActions: actions.paletteActions,
    showNewFolder: actions.showNewFolder,
    setShowNewFolder: actions.setShowNewFolder,
    renameTarget: actions.renameTarget,
    setRenameTarget: actions.setRenameTarget,
    shareTarget: actions.shareTarget,
    setShareTarget: actions.setShareTarget,
    moveTargets: actions.moveTargets,
    setMoveTargets: actions.setMoveTargets,
    deleteForeverTargets: actions.deleteForeverTargets,
    setDeleteForeverTargets: actions.setDeleteForeverTargets,
    emptyTrashConfirm: actions.emptyTrashConfirm,
    setEmptyTrashConfirm: actions.setEmptyTrashConfirm,
    bulkRenameOpen: actions.bulkRenameOpen,
    setBulkRenameOpen: actions.setBulkRenameOpen,
    menu: actions.menu,
    setMenu: actions.setMenu,
    tagManageOpen: actions.tagManageOpen,
    setTagManageOpen: actions.setTagManageOpen,
    tagPickerOpen: actions.tagPickerOpen,
    setTagPickerOpen: actions.setTagPickerOpen,
    tagPickerFileIds: actions.tagPickerFileIds,
    tagPickerFileNames: actions.tagPickerFileNames,
    tagPickerLabel: actions.tagPickerLabel,
    saveViewOpen: actions.saveViewOpen,
    setSaveViewOpen: actions.setSaveViewOpen,
    coverModalFolder: actions.coverModalFolder,
    setCoverModalFolder: actions.setCoverModalFolder,
    openFile: actions.openFile,
    navigateTo: actions.navigateTo,
    goBack: actions.goBack,
    openMenu: actions.openMenu,
    openTagPicker: actions.openTagPicker,
    captureCurrentViewScope: actions.captureCurrentViewScope,
    setTagFilterMode: actions.setTagFilterMode,
    handleOpenFileFromActivity: actions.handleOpenFileFromActivity,
    runPaletteAction: actions.runPaletteAction,
    handleCreateFolder: actions.handleCreateFolder,
    handleUpload: actions.handleUpload,
    handleToggleStar: actions.handleToggleStar,
    handleTogglePin: actions.handleTogglePin,
    handleToggleFavorite: actions.handleToggleFavorite,
    handleToggleHidden: actions.handleToggleHidden,
    handleSetFolderCover: actions.handleSetFolderCover,
    handleRemoveFolderCover: actions.handleRemoveFolderCover,
    handleUploadFolderCover: actions.handleUploadFolderCover,
    handleCut: actions.handleCut,
    handleCopy: actions.handleCopy,
    handlePaste: actions.handlePaste,
    handleCancelClipboard: actions.handleCancelClipboard,
    onFileChanged: actions.onFileChanged,
    onFileDeleted: actions.onFileDeleted,
    handleDownload: actions.handleDownload,
    handleRename: actions.handleRename,
    handleTrashFiles: actions.handleTrashFiles,
    handleRestoreFiles: actions.handleRestoreFiles,
    handleDeleteForever: actions.handleDeleteForever,
    handleEmptyTrash: actions.handleEmptyTrash,
    handleMoveMany: actions.handleMoveMany,
    handleBulkDownload: actions.handleBulkDownload,
    dragDrop: actions.dragDrop,
    tagsByFileId, tags, counts,
  };
}
