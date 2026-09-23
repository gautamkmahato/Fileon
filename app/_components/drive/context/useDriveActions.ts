"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  type DriveFile,
  createFolder,
  downloadFile,
  exportFile,
  isFolder,
  isGoogleNative,
  renameFile,
  restoreFile,
  setStarred,
  trashFile,
  uploadFile,
  deleteForever,
  emptyTrash,
} from "@/lib/drive/drive";
import { moveFile, copyFile } from "@/lib/drive/drive-extras";
import { downloadFilesAsZip } from "@/lib/utils/bulk-download";
import { computeSelection } from "@/lib/utils/selection";
import { useDragDrop } from "@/lib/hooks/useDragDrop";
import { toast, runAsync, updateLoading } from "@/lib/toast";
import { canUndo, executeUndo, pushUndo, type UndoActionType } from "@/lib/undo";
import { logActivity, prepareActivityUndo } from "@/lib/activity-log";
import { driveRoutes } from "@/lib/navigation";
import { useCleanupStore } from "@/lib/cleanup/store";
import { patchCleanupFile, removeCleanupFile } from "@/lib/cleanup/repository";
import { recordRecentFolderWork } from "@/lib/recent-folders";
import { invalidateFolderTreeForMutation } from "@/lib/cache/folder-children-cache";
import { invalidateTypeBrowseCountsCache } from "@/lib/cache/type-browse-counts-cache";
import { isFolderBrowseView } from "@/lib/drive/browse-scope";
import type { TagFilterMode } from "@/lib/tags";

function parentIdForFolderTree(parentId: string | null | undefined): string | null {
  if (!parentId || parentId === "root") return null;
  return parentId;
}

function parentsFromFiles(files: DriveFile[]): (string | null)[] {
  return files.map((f) => parentIdForFolderTree(f.parents?.[0]));
}
import type { ViewScope } from "@/lib/views";
import { DASHBOARD_PINS_KEY, removeAllPinsForFile } from "@/lib/pins";
import { removeFavoriteForFolder } from "@/lib/favorites";
import { removeHiddenForFile } from "@/lib/hidden";
import { addToInbox, removeInboxForFile } from "@/lib/inbox";
import { removeCoversForFile, removeFolderCover } from "@/lib/folder-covers";
import type { CoverPosition } from "@/lib/folder-covers";
import type { MenuPointer } from "../menu/FileMenu";
import { usePins } from "../../pins/PinsProvider";
import { useFavorites } from "../../favorites/FavoritesProvider";
import { useHidden } from "../../hidden/HiddenProvider";
import { useFolderCovers } from "../../folder-covers/FolderCoversProvider";
import { buildDefaultActions, type PaletteActionId } from "../../ui/CommandPalette";
import {
  getSelectedDriveFiles,
  getSelectedIdSet,
  useBrowseStore,
  useClipboardStore,
  useFilesStore,
  useSelectionStore,
} from "@/lib/stores";
import type { DriveRouteState } from "./drive-browse-types";
import type { DriveFilesContext } from "./drive-files-types";

export interface UseDriveActionsParams {
  token: string | null;
  signOut: () => void;
  routeState: DriveRouteState;
  filesCtx: DriveFilesContext;
  clearSelection: () => void;
}

export function useDriveActions({
  token,
  signOut,
  routeState,
  filesCtx,
  clearSelection,
}: UseDriveActionsParams) {
  const router = useRouter();
  const {
    sidebarView, routeFolderId, routeTagIds, routeTagMode, typeCategory,
    isSavedView, isTrashView, isTagsView, isActivityView, isHiddenView, isCleanupView, scopeTagIds,
  } = routeState;

  const { pin, unpin, isPinned: checkPinned } = usePins();
  const { favorite, unfavorite, isFavorite: checkFavorite } = useFavorites();
  const { isHidden: checkHidden, hideMany, unhideMany } = useHidden();
  const { setCover, removeCover } = useFolderCovers();

  const {
    folderStack, setFolderStack, currentFolder, canGoBack, folderContext,
    files, visibleFolders, visibleFiles, visibleIdsRef, loadFiles,
  } = filesCtx;

  const uploadInputRef = useRef<HTMLInputElement>(null);
  const uploading = useFilesStore((s) => s.uploading);
  const uploadLabel = useFilesStore((s) => s.uploadLabel);
  const view = useBrowseStore((s) => s.view);

  const [previewFile, setPreviewFile] = useState<DriveFile | null>(null);
  const [quickLookFile, setQuickLookFile] = useState<DriveFile | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [renameTarget, setRenameTarget] = useState<DriveFile | null>(null);
  const [shareTarget, setShareTarget] = useState<DriveFile | null>(null);
  const [moveTargets, setMoveTargets] = useState<DriveFile[] | null>(null);
  const [deleteForeverTargets, setDeleteForeverTargets] = useState<DriveFile[] | null>(null);
  const [emptyTrashConfirm, setEmptyTrashConfirm] = useState(false);
  const [bulkRenameOpen, setBulkRenameOpen] = useState(false);
  const [menu, setMenu] = useState<{ file: DriveFile; rect: DOMRect; pointer?: MenuPointer } | null>(null);
  const [tagManageOpen, setTagManageOpen] = useState(false);
  const [tagPickerOpen, setTagPickerOpen] = useState(false);
  const [tagPickerFileIds, setTagPickerFileIds] = useState<string[]>([]);
  const [tagPickerFileNames, setTagPickerFileNames] = useState<string[]>([]);
  const [tagPickerLabel, setTagPickerLabel] = useState("");
  const [saveViewOpen, setSaveViewOpen] = useState(false);
  const [coverModalFolder, setCoverModalFolder] = useState<DriveFile | null>(null);

  const paletteActions = buildDefaultActions(view);

  function markFolderWork(
    items?: DriveFile | DriveFile[],
    opts?: { destinationFolderId?: string | null },
  ) {
    const list = items === undefined ? [] : Array.isArray(items) ? items : [items];
    recordRecentFolderWork({
      locationFolderId: isFolderBrowseView(sidebarView)
        ? (currentFolder.id ?? routeFolderId)
        : routeFolderId,
      items: list,
      destinationFolderId: opts?.destinationFolderId,
    });
  }

  async function recordUndoAction(opts: {
    activityType: import("@/lib/activity-log").ActivityType;
    undoType: UndoActionType;
    description: string;
    fileIds: string[];
    fileNames: string[];
    undo: () => Promise<void>;
    undoData?: import("@/lib/activity-log").ActivityUndoData;
    ctx?: string;
  }) {
    const activityId = await prepareActivityUndo({
      type: opts.activityType,
      description: opts.description,
      fileIds: opts.fileIds,
      fileNames: opts.fileNames,
      folderContext: opts.ctx ?? folderContext,
      undoData: opts.undoData,
      undo: opts.undo,
    });
    pushUndo({
      type: opts.undoType,
      message: opts.description,
      undo: opts.undo,
      activityId: activityId ?? undefined,
    });
  }

  function openFile(file: DriveFile) {
    if (isTrashView && !isFolder(file)) {
      toast.info("Restore this file to open it", {
        action: { label: "Restore", onClick: () => handleRestoreFiles([file]) },
      });
      return;
    }
    if (isFolder(file)) {
      router.push(driveRoutes.folder(file.id));
      setFolderStack((prev) => {
        if (sidebarView === "drive") {
          const last = prev[prev.length - 1];
          if (last?.id === file.id) return prev;
          return [...prev, { id: file.id, name: file.name }];
        }
        return [{ id: null, name: "My Drive" }, { id: file.id, name: file.name }];
      });
      useBrowseStore.getState().setSearch("");
      clearSelection();
    } else {
      setPreviewFile(file);
    }
  }

  function handleItemSelect(file: DriveFile, e: React.MouseEvent) {
    const cleanupIds = useCleanupStore.getState().visibleIds;
    const orderedIds = isCleanupView && cleanupIds.length
      ? cleanupIds
      : visibleIdsRef.current.length
      ? visibleIdsRef.current
      : [...visibleFolders, ...visibleFiles].map((f) => f.id);
    const { selectedIds, lastSelectedId } = useSelectionStore.getState();
    const result = computeSelection(
      file.id,
      orderedIds,
      new Set(selectedIds),
      lastSelectedId,
      { shiftKey: e.shiftKey, metaKey: e.metaKey, ctrlKey: e.ctrlKey }
    );
    useSelectionStore.getState().applySelectionResult(result);
  }

  function navigateTo(index: number) {
    if (sidebarView === "type") {
      if (index === 0) {
        router.push(driveRoutes.dashboard);
        useBrowseStore.getState().setSearch("");
        clearSelection();
      }
      return;
    }
    const crumb = folderStack[index];
    if (crumb.id === null) {
      router.push(sidebarView === "dashboard" ? driveRoutes.dashboard : driveRoutes.myDrive);
    } else {
      router.push(driveRoutes.folder(crumb.id));
    }
    setFolderStack(folderStack.slice(0, index + 1));
    useBrowseStore.getState().setSearch("");
    clearSelection();
  }

  function goBack() {
    if (sidebarView === "type") {
      router.push(driveRoutes.dashboard);
      useBrowseStore.getState().setSearch("");
      clearSelection();
      return;
    }
    if (!canGoBack) return;
    const parent = folderStack[folderStack.length - 2];
    if (parent.id === null) {
      router.push(sidebarView === "dashboard" ? driveRoutes.dashboard : driveRoutes.myDrive);
    } else {
      router.push(driveRoutes.folder(parent.id));
    }
    setFolderStack(folderStack.slice(0, -1));
    useBrowseStore.getState().setSearch("");
    clearSelection();
  }

  async function handleCreateFolder(name: string) {
    if (!token) return;
    await runAsync({
      loading: `Creating folder "${name}"…`,
      success: `Created folder "${name}"`,
      error: "Failed to create folder",
      fn: async () => {
        const created = await createFolder(token, name, currentFolder.id);
        useFilesStore.getState().prependFile(created);
        await logActivity({
          type: "create-folder",
          description: `Created folder "${name}"`,
          fileIds: [created.id],
          fileNames: [name],
          folderContext,
        });
        markFolderWork();
        invalidateFolderTreeForMutation({
          invalidateParents: [currentFolder.id ?? null],
        });
        return created;
      },
    });
  }

  async function handleUpload(fileList: FileList | null) {
    if (!token || !fileList?.length || !isFolderBrowseView(sidebarView) || uploading) return;
    const toUpload = Array.from(fileList);
    useFilesStore.getState().setUploading(true);
    const toastId = toast.loading(
      toUpload.length === 1
        ? `Uploading "${toUpload[0].name}"…`
        : `Uploading 1 of ${toUpload.length}…`
    );
    let succeeded = 0;
    const uploadedFiles: DriveFile[] = [];
    try {
      for (let i = 0; i < toUpload.length; i++) {
        const f = toUpload[i];
        const label = toUpload.length === 1
          ? `Uploading "${f.name}"…`
          : `Uploading ${i + 1} of ${toUpload.length}: ${f.name}`;
        useFilesStore.getState().setUploading(true, label);
        updateLoading(label, toastId);
        try {
          const uploaded = await uploadFile({ token, file: f, parentId: currentFolder.id });
          useFilesStore.getState().prependFile(uploaded);
          uploadedFiles.push(uploaded);
          succeeded++;
        } catch (err) {
          console.error(err);
          toast.error(`Upload failed: ${f.name}`);
        }
      }
      if (succeeded > 0) {
        const uploadDesc = succeeded === 1 && toUpload.length === 1
          ? `Uploaded "${toUpload[0].name}" to ${folderContext}`
          : `Uploaded ${succeeded} file${succeeded === 1 ? "" : "s"} to ${folderContext}`;
        await logActivity({
          type: "upload",
          description: uploadDesc,
          fileIds: uploadedFiles.map((f) => f.id),
          fileNames: uploadedFiles.map((f) => f.name),
          folderContext,
        });
        markFolderWork(uploadedFiles);
        invalidateTypeBrowseCountsCache({ refreshToken: token });
        const inboxIds = uploadedFiles.filter((f) => !isFolder(f)).map((f) => f.id);
        if (inboxIds.length) {
          try { await addToInbox(inboxIds); } catch { /* inbox is best-effort */ }
        }
        toast.success(
          succeeded === 1 && toUpload.length === 1
            ? `Uploaded "${toUpload[0].name}"`
            : `Uploaded ${succeeded} file${succeeded === 1 ? "" : "s"}`,
          { id: toastId }
        );
      } else {
        toast.dismiss(toastId);
      }
    } finally {
      useFilesStore.getState().setUploading(false);
    }
  }

  async function handleToggleStar(file: DriveFile) {
    if (!token) return;
    const optimistic = { ...file, starred: !file.starred };
    onFileChanged(optimistic);
    try {
      const updated = await setStarred(token, file.id, !file.starred);
      onFileChanged(updated);
      await logActivity({
        type: updated.starred ? "star" : "unstar",
        description: updated.starred ? `Starred ${file.name}` : `Unstarred ${file.name}`,
        fileIds: [file.id],
        fileNames: [file.name],
        folderContext,
      });
      toast.success(
        updated.starred ? `Starred "${file.name}"` : `Unstarred "${file.name}"`
      );
      markFolderWork(file);
    } catch (err) {
      console.error(err);
      onFileChanged(file);
      toast.error("Failed to update star");
    }
  }

  async function handleToggleFavorite(targets?: DriveFile[]) {
    const items = (targets ?? getSelectedDriveFiles()).filter(isFolder);
    if (!items.length) return;
    if (isTrashView || isActivityView) {
      toast.info("Cannot favorite items here");
      return;
    }
    const allFavorited = items.every((f) => checkFavorite(f.id));
    if (allFavorited) {
      await Promise.all(items.map((f) => unfavorite(f.id)));
      await Promise.all(items.map((f) => logActivity({
        type: "unpin",
        description: `Removed ${f.name} from favorites`,
        fileIds: [f.id],
        fileNames: [f.name],
        folderContext,
      })));
      toast.success(
        items.length === 1
          ? `Removed "${items[0].name}" from favorites`
          : `Removed ${items.length} folders from favorites`,
      );
    } else {
      const toFavorite = items.filter((f) => !checkFavorite(f.id));
      await Promise.all(toFavorite.map((f) => favorite(f.id)));
      await Promise.all(toFavorite.map((f) => logActivity({
        type: "pin",
        description: `Added ${f.name} to favorites`,
        fileIds: [f.id],
        fileNames: [f.name],
        folderContext,
      })));
      toast.success(
        toFavorite.length === 1
          ? `Added "${toFavorite[0].name}" to favorites`
          : `Added ${toFavorite.length} folders to favorites`,
      );
    }
    markFolderWork(items);
  }

  async function handleTogglePin(targets?: DriveFile[]) {
    const all = targets ?? getSelectedDriveFiles();
    if (!all.length) return;

    const folders = all.filter(isFolder);
    const files = all.filter((f) => !isFolder(f));

    if (folders.length) await handleToggleFavorite(folders);
    if (!files.length) return;

    const items = files;
    if (isTrashView || isActivityView) {
      toast.info("Cannot pin items here");
      return;
    }
    const folderKey = DASHBOARD_PINS_KEY;
    const allPinned = items.every((f) => checkPinned(folderKey, f.id));
    if (allPinned) {
      await Promise.all(items.map((f) => unpin(folderKey, f.id)));
      await Promise.all(items.map((f) => logActivity({
        type: "unpin",
        description: `Unpinned ${f.name}`,
        fileIds: [f.id],
        fileNames: [f.name],
        folderContext,
      })));
      toast.success(items.length === 1 ? `Unpinned "${items[0].name}"` : `Unpinned ${items.length} items`);
    } else {
      const toPin = items.filter((f) => !checkPinned(folderKey, f.id));
      await Promise.all(toPin.map((f) => pin(folderKey, f.id)));
      await Promise.all(toPin.map((f) => logActivity({
        type: "pin",
        description: `Pinned ${f.name}`,
        fileIds: [f.id],
        fileNames: [f.name],
        folderContext,
      })));
      toast.success(toPin.length === 1 ? `Pinned "${toPin[0].name}"` : `Pinned ${toPin.length} items`);
    }
    markFolderWork(items);
  }

  async function handleToggleHidden(targets?: DriveFile[]) {
    const items = targets ?? getSelectedDriveFiles();
    if (!items.length) return;
    if (isTrashView || isActivityView) {
      toast.info("Cannot hide items here");
      return;
    }
    const ids = items.map((f) => f.id);
    const allHidden = items.every((f) => checkHidden(f.id));
    if (allHidden || isHiddenView) {
      await unhideMany(ids);
      await Promise.all(items.map((f) => logActivity({
        type: "unhide",
        description: `Unhid ${f.name}`,
        fileIds: [f.id],
        fileNames: [f.name],
        folderContext,
      })));
      toast.success(
        items.length === 1
          ? `Unhid "${items[0].name}"`
          : `Unhid ${items.length} items`,
      );
    } else {
      const toHide = items.filter((f) => !checkHidden(f.id));
      await hideMany(toHide.map((f) => f.id));
      await Promise.all(toHide.map((f) => logActivity({
        type: "hide",
        description: `Hid ${f.name}`,
        fileIds: [f.id],
        fileNames: [f.name],
        folderContext,
      })));
      toast.success(
        toHide.length === 1
          ? `Hid "${toHide[0].name}" — still visible in Google Drive`
          : `Hid ${toHide.length} items — still visible in Google Drive`,
      );
    }
    clearSelection();
    markFolderWork(items);
  }

  function folderKeyForClipboard(): string {
    return currentFolder.id ?? "root";
  }

  function handleCut() {
    if (isTrashView || !isFolderBrowseView(sidebarView)) {
      toast.info("Cut is only available in folder view");
      return;
    }
    const items = getSelectedDriveFiles();
    if (!items.length) return;
    useClipboardStore.getState().setCut(items, folderKeyForClipboard());
    toast.success(
      items.length === 1
        ? `Cut "${items[0].name}" — ⌘V to paste`
        : `${items.length} files cut — ⌘V to paste`
    );
  }

  function handleCopy() {
    if (isTrashView || !isFolderBrowseView(sidebarView)) {
      toast.info("Copy is only available in folder view");
      return;
    }
    const items = getSelectedDriveFiles();
    if (!items.length) return;
    useClipboardStore.getState().setCopy(items, folderKeyForClipboard());
    toast.success(
      items.length === 1
        ? `Copied "${items[0].name}"`
        : `Copied ${items.length} files`
    );
  }

  function handleCancelClipboard() {
    useClipboardStore.getState().clear();
  }

  async function handlePaste() {
    if (!token) return;
    const { mode, items } = useClipboardStore.getState();
    if (!mode || !items.length) return;
    if (isTrashView || !isFolderBrowseView(sidebarView)) {
      toast.info("Paste into a folder in My Drive");
      return;
    }

    const destId = currentFolder.id ?? "root";
    const asFiles: DriveFile[] = items.map((item) => ({
      id: item.id,
      name: item.name,
      mimeType: item.mimeType,
      parents: item.parents,
    }));

    if (mode === "cut") {
      const allSameFolder = items.every(
        (item) => (item.parents?.[0] ?? "root") === destId
      );
      if (allSameFolder) {
        toast.info("Items are already in this folder");
        useClipboardStore.getState().clear();
        return;
      }
      await handleMoveMany(asFiles, destId, currentFolder.name);
      await loadFiles();
      useClipboardStore.getState().clear();
      return;
    }

    const multi = items.length >= 2;
    if (multi) useSelectionStore.getState().setSelectionBusy(true, "Copying…");
    let copied: DriveFile[] = [];
    await runAsync({
      loading: items.length === 1
        ? `Copying "${items[0].name}"…`
        : `Copying ${items.length} items…`,
      success: items.length === 1
        ? `Copied "${items[0].name}" here`
        : `Copied ${items.length} items here`,
      error: "Copy failed",
      fn: async () => {
        copied = await Promise.all(
          items.map((item) => copyFile({ token, fileId: item.id, newParentId: destId }))
        );
        if (destId === folderKeyForClipboard()) {
          copied.forEach((f) => useFilesStore.getState().prependFile(f));
        } else {
          await loadFiles();
        }
        clearSelection();
      },
    });
    if (copied.length) {
      markFolderWork(copied, {
        destinationFolderId: destId !== "root" ? destId : null,
      });
    }
    if (multi) useSelectionStore.getState().setSelectionBusy(false);
    useClipboardStore.getState().clear();
  }

  function onFileChanged(updated: DriveFile) {
    useFilesStore.getState().updateFile(updated);
    useCleanupStore.getState().updateFile(updated);
    const userId = useCleanupStore.getState().hydratedUserId;
    if (userId) void patchCleanupFile(userId, updated).catch(() => {});
    if (previewFile?.id === updated.id) setPreviewFile(updated);
  }

  function onFileDeleted(id: string) {
    useFilesStore.getState().removeFile(id);
    useSelectionStore.getState().removeFromSelection(id);
    useCleanupStore.getState().removeFile(id);
    const userId = useCleanupStore.getState().hydratedUserId;
    if (userId) void removeCleanupFile(userId, id).catch(() => {});
  }

  async function handleDownload(file: DriveFile) {
    if (!token) return;
    await runAsync({
      loading: `Downloading "${file.name}"…`,
      success: "Download started",
      error: "Download failed",
      fn: async () => {
        let blob: Blob;
        let name = file.name;
        if (isGoogleNative(file)) {
          blob = await exportFile(token, file.id, "application/pdf");
          if (!name.toLowerCase().endsWith(".pdf")) name += ".pdf";
        } else {
          blob = await downloadFile(token, file.id);
        }
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = name;         a.click();
        URL.revokeObjectURL(url);
        markFolderWork(file);
      },
    });
  }

  async function handleRename(file: DriveFile, newName: string) {
    if (!token) return;
    const oldName = file.name;
    if (newName === oldName) return;
    await runAsync({
      loading: "Renaming…",
      success: false,
      error: "Rename failed",
      fn: async () => {
        const updated = await renameFile(token, file.id, newName);
        onFileChanged(updated);
        const desc = `Renamed ${oldName} → ${newName}`;
        const undoFn = async () => {
          const reverted = await renameFile(token, file.id, oldName);
          onFileChanged(reverted);
          if (isFolder(file)) {
            invalidateFolderTreeForMutation({
              renamed: [{ id: file.id, name: oldName }],
            });
          }
        };
        await recordUndoAction({
          activityType: "rename",
          undoType: "rename",
          description: desc,
          fileIds: [file.id],
          fileNames: [newName],
          undo: undoFn,
          undoData: { type: "rename", fileIds: [file.id], oldNames: [oldName], newNames: [newName] },
        });
        markFolderWork(file);
        if (isFolder(file)) {
          invalidateFolderTreeForMutation({
            renamed: [{ id: file.id, name: newName }],
          });
        }
        return updated;
      },
    });
  }

  async function handleTrashFiles(targets: DriveFile[]) {
    if (!token || !targets.length) return;
    const snapshot = [...targets];
    const multi = snapshot.length >= 2;
    if (multi) useSelectionStore.getState().setSelectionBusy(true, "Moving to trash…");
    const successMsg = snapshot.length === 1
      ? `Moved "${snapshot[0].name}" to trash`
      : `Moved ${snapshot.length} items to trash`;
    await runAsync({
      loading: snapshot.length === 1
        ? `Moving "${snapshot[0].name}" to trash…`
        : `Moving ${snapshot.length} items to trash…`,
      success: false,
      error: "Move to trash failed",
      fn: async () => {
        await Promise.all(snapshot.map((f) => trashFile(token, f.id)));
        await Promise.all(snapshot.map((f) => removeAllPinsForFile(f.id)));
        await Promise.all(snapshot.filter(isFolder).map((f) => removeFavoriteForFolder(f.id)));
        await Promise.all(snapshot.map((f) => removeHiddenForFile(f.id)));
        await Promise.all(snapshot.map((f) => removeInboxForFile(f.id)));
        await Promise.all(snapshot.map((f) => removeCoversForFile(f.id)));
        await Promise.all(
          snapshot.filter(isFolder).map((f) => removeFolderCover(f.id)),
        );
        snapshot.forEach((f) => onFileDeleted(f.id));
        if (previewFile && snapshot.some((f) => f.id === previewFile.id)) setPreviewFile(null);
        clearSelection();
        const undoFn = async () => {
          const restored = await Promise.all(snapshot.map((f) => restoreFile(token, f.id)));
          restored.forEach((f) => useFilesStore.getState().prependFile(f));
          invalidateFolderTreeForMutation({
            invalidateParents: parentsFromFiles(restored),
          });
          invalidateTypeBrowseCountsCache({ refreshToken: token });
        };
        await recordUndoAction({
          activityType: "trash",
          undoType: "trash",
          description: successMsg,
          fileIds: snapshot.map((f) => f.id),
          fileNames: snapshot.map((f) => f.name),
          undo: undoFn,
          undoData: { type: "trash", fileIds: snapshot.map((f) => f.id) },
        });
        markFolderWork(snapshot);
        invalidateFolderTreeForMutation({
          invalidateParents: parentsFromFiles(snapshot),
          removedFolderIds: snapshot.filter(isFolder).map((f) => f.id),
        });
        invalidateTypeBrowseCountsCache({ refreshToken: token });
      },
    });
    if (multi) useSelectionStore.getState().setSelectionBusy(false);
  }

  async function handleRestoreFiles(targets: DriveFile[]) {
    if (!token || !targets.length) return;
    const multi = targets.length >= 2;
    if (multi) useSelectionStore.getState().setSelectionBusy(true, "Restoring…");
    await runAsync({
      loading: targets.length === 1
        ? `Restoring "${targets[0].name}"…`
        : `Restoring ${targets.length} items…`,
      success: targets.length === 1
        ? `Restored "${targets[0].name}"`
        : `Restored ${targets.length} items`,
      error: "Restore failed",
      fn: async () => {
        await Promise.all(targets.map((f) => restoreFile(token, f.id)));
        targets.forEach((f) => onFileDeleted(f.id));
        clearSelection();
        const desc = targets.length === 1
          ? `Restored ${targets[0].name} from trash`
          : `Restored ${targets.length} files from trash`;
        await logActivity({
          type: "restore",
          description: desc,
          fileIds: targets.map((f) => f.id),
          fileNames: targets.map((f) => f.name),
          folderContext: "Trash",
        });
        invalidateFolderTreeForMutation({
          invalidateParents: parentsFromFiles(targets),
        });
        invalidateTypeBrowseCountsCache({ refreshToken: token });
      },
    });
    if (multi) useSelectionStore.getState().setSelectionBusy(false);
  }

  async function handleDeleteForever(targets: DriveFile[]) {
    if (!token || !targets.length) return;
    const multi = targets.length >= 2;
    if (multi) useSelectionStore.getState().setSelectionBusy(true, "Deleting…");
    await runAsync({
      loading: targets.length === 1
        ? `Deleting "${targets[0].name}"…`
        : `Deleting ${targets.length} items…`,
      success: targets.length === 1
        ? `"${targets[0].name}" deleted forever`
        : `${targets.length} items deleted forever`,
      error: "Delete failed",
      fn: async () => {
        await Promise.all(targets.map((f) => deleteForever(token, f.id)));
        await Promise.all(targets.map((f) => removeInboxForFile(f.id)));
        targets.forEach((f) => onFileDeleted(f.id));
        if (previewFile && targets.some((f) => f.id === previewFile.id)) setPreviewFile(null);
        clearSelection();
        const desc = targets.length === 1
          ? `Permanently deleted ${targets[0].name}`
          : `Permanently deleted ${targets.length} files`;
        await logActivity({
          type: "delete-forever",
          description: desc,
          fileIds: targets.map((f) => f.id),
          fileNames: targets.map((f) => f.name),
          folderContext: "Trash",
        });
        invalidateTypeBrowseCountsCache({ refreshToken: token });
      },
    });
    if (multi) useSelectionStore.getState().setSelectionBusy(false);
  }

  async function handleEmptyTrash() {
    if (!token) return;
    await runAsync({
      loading: "Emptying trash…",
      success: "Trash emptied",
      error: "Failed to empty trash",
      fn: async () => {
        await emptyTrash(token);
        useFilesStore.getState().clearFiles();
        clearSelection();
        invalidateTypeBrowseCountsCache({ refreshToken: token });
      },
    });
  }

  async function handleMove(file: DriveFile, newParentId: string) {
    if (!token) return;
    const oldParentId = file.parents?.[0] || (currentFolder.id || "root");
    await moveFile({ token, fileId: file.id, newParentId, oldParentId });
    const isStillHere = newParentId === (currentFolder.id || "root") && isFolderBrowseView(sidebarView);
    if (!isStillHere) {
      onFileDeleted(file.id);
      if (previewFile?.id === file.id) setPreviewFile(null);
    }
  }

  async function handleMoveMany(targets: DriveFile[], newParentId: string, destName?: string) {
    if (!token || !targets.length) return;
    const snapshot = targets.map((file) => ({
      file,
      oldParentId: file.parents?.[0] || (currentFolder.id || "root"),
    }));
    const multi = snapshot.length >= 2;
    if (multi) useSelectionStore.getState().setSelectionBusy(true, "Moving…");
    const destination = destName ?? files.find((f) => f.id === newParentId)?.name ?? "folder";
    const successMsg = snapshot.length === 1
      ? `Moved "${snapshot[0].file.name}" to ${destination}`
      : `Moved ${snapshot.length} files to ${destination}`;
    await runAsync({
      loading: snapshot.length === 1
        ? `Moving "${snapshot[0].file.name}"…`
        : `Moving ${snapshot.length} items…`,
      success: false,
      error: (err) => `Move failed: ${err instanceof Error ? err.message : "Unknown error"}`,
      fn: async () => {
        await Promise.all(snapshot.map(({ file }) => handleMove(file, newParentId)));
        clearSelection();
        const undoFn = async () => {
          for (const { file, oldParentId } of snapshot) {
            await moveFile({ token, fileId: file.id, newParentId: oldParentId, oldParentId: newParentId });
            const currentParent = currentFolder.id || "root";
            if (oldParentId === currentParent && isFolderBrowseView(sidebarView)) {
              useFilesStore.getState().prependFile({ ...file, parents: [oldParentId] });
            }
          }
          invalidateFolderTreeForMutation({
            invalidateParents: [
              parentIdForFolderTree(newParentId),
              ...snapshot.map(({ oldParentId }) => parentIdForFolderTree(oldParentId)),
            ],
          });
        };
        await recordUndoAction({
          activityType: "move",
          undoType: "move",
          description: successMsg,
          fileIds: snapshot.map(({ file }) => file.id),
          fileNames: snapshot.map(({ file }) => file.name),
          undo: undoFn,
          undoData: {
            type: "move",
            fileIds: snapshot.map(({ file }) => file.id),
            oldParentIds: snapshot.map(({ oldParentId }) => oldParentId),
            newParentId,
          },
        });
        markFolderWork(
          snapshot.map(({ file }) => file),
          { destinationFolderId: newParentId !== "root" ? newParentId : null },
        );
        invalidateFolderTreeForMutation({
          invalidateParents: [
            parentIdForFolderTree(newParentId),
            ...snapshot.map(({ oldParentId }) => parentIdForFolderTree(oldParentId)),
          ],
        });
      },
    });
    if (multi) useSelectionStore.getState().setSelectionBusy(false);
  }

  async function handleBulkDownload() {
    if (!token) return;
    const targets = getSelectedDriveFiles().filter((f) => !isFolder(f));
    if (!targets.length) return;
    useSelectionStore.getState().setSelectionBusy(
      true,
      targets.length === 1 ? "Downloading…" : `Preparing ${targets.length} files…`
    );
    await runAsync({
      loading: targets.length === 1
        ? `Downloading "${targets[0].name}"…`
        : `Preparing download (${targets.length} files)…`,
      success: targets.length === 1 ? "Download started" : "Download started",
      error: "Download failed",
      fn: async () => {
        if (targets.length === 1) {
          let blob: Blob;
          let name = targets[0].name;
          if (isGoogleNative(targets[0])) {
            blob = await exportFile(token, targets[0].id, "application/pdf");
            if (!name.toLowerCase().endsWith(".pdf")) name += ".pdf";
          } else {
            blob = await downloadFile(token, targets[0].id);
          }
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url; a.download = name; a.click();
          URL.revokeObjectURL(url);
        } else {
          await downloadFilesAsZip(token, targets);
        }
        markFolderWork(targets);
      },
    });
    useSelectionStore.getState().setSelectionBusy(false);
  }

  function openTagPicker(targets: DriveFile[]) {
    setTagPickerFileIds(targets.map((t) => t.id));
    setTagPickerFileNames(targets.map((t) => t.name));
    setTagPickerLabel(
      targets.length === 1 ? targets[0].name : `${targets.length} items`
    );
    setTagPickerOpen(true);
  }

  function openMenu(file: DriveFile, anchor: HTMLElement, e?: React.MouseEvent) {
    setMenu({
      file,
      rect: anchor.getBoundingClientRect(),
      pointer: e ? { x: e.clientX, y: e.clientY } : undefined,
    });
    useSelectionStore.getState().setSelection([file.id], file.id);
  }

  const dragDrop = useDragDrop({
    onUploadFiles: (fl) => handleUpload(fl),
    onMoveFiles: (ids, folderId) => {
      const moveFiles = files.filter((f) => ids.includes(f.id));
      const destName = files.find((f) => f.id === folderId)?.name;
      handleMoveMany(moveFiles, folderId, destName);
    },
    getDragFileIds: () => [...getSelectedIdSet()],
  });

  function runPaletteAction(id: PaletteActionId) {
    switch (id) {
      case "new-folder": setShowNewFolder(true); break;
      case "upload": uploadInputRef.current?.click(); break;
      case "toggle-view": useBrowseStore.getState().setView(view === "grid" ? "list" : "grid"); break;
      case "sign-out": signOut(); break;
    }
  }

  async function handleSetFolderCover(
    folderId: string,
    coverFileId: string,
    position: CoverPosition = "center",
  ) {
    await setCover(folderId, coverFileId, position);
    markFolderWork(undefined, { destinationFolderId: folderId });
    toast.success("Cover image set");
  }

  async function handleRemoveFolderCover(folderId: string) {
    await removeCover(folderId);
    markFolderWork(undefined, { destinationFolderId: folderId });
    toast.success("Cover removed");
  }

  async function handleUploadFolderCover(folder: DriveFile, file: File) {
    if (!token) return;
    await runAsync({
      loading: "Uploading cover…",
      success: "Cover uploaded and set",
      error: "Upload failed",
      fn: async () => {
        const uploaded = await uploadFile({ token, file, parentId: folder.id });
        await setCover(folder.id, uploaded.id, "center");
        markFolderWork(folder);
      },
    });
  }

  function isBlockingModalOpen() {
    return (
      globalSearchOpen || paletteOpen || shortcutsOpen || showNewFolder || renameTarget !== null ||
      shareTarget !== null || moveTargets !== null || deleteForeverTargets !== null ||
      emptyTrashConfirm || bulkRenameOpen || menu !== null ||
      tagManageOpen || tagPickerOpen || saveViewOpen || coverModalFolder !== null
    );
  }

  function openQuickLook(file: DriveFile) {
    setQuickLookFile(file);
    useSelectionStore.getState().setSelection([file.id], file.id);
  }

  function closeQuickLook() {
    setQuickLookFile(null);
  }

  function handleQuickLookNavigate(file: DriveFile) {
    setQuickLookFile(file);
    useSelectionStore.getState().setSelection([file.id], file.id);
  }

  function captureCurrentViewScope(): ViewScope {
    if (isTagsView) {
      return { view: "tags", folderId: null, tagIds: [...routeTagIds], tagMode: routeTagMode };
    }
    if (sidebarView === "starred") return { view: "starred", folderId: null, tagIds: [], tagMode: "or" };
    if (sidebarView === "recent") return { view: "recent", folderId: null, tagIds: [], tagMode: "or" };
    if (sidebarView === "type" && typeCategory) {
      return { view: "type", folderId: null, tagIds: [], tagMode: "or", typeCategory };
    }
    if (sidebarView === "shared-links") {
      return { view: "dashboard", folderId: null, tagIds: [], tagMode: "or" };
    }
    if (sidebarView === "dashboard") return { view: "dashboard", folderId: null, tagIds: [], tagMode: "or" };
    return { view: "drive", folderId: routeFolderId, tagIds: [], tagMode: "or" };
  }

  function setTagFilterMode(mode: TagFilterMode) {
    if (scopeTagIds.length <= 1 || isSavedView) return;
    router.push(driveRoutes.tagFilter(scopeTagIds, mode));
  }

  function handleOpenFileFromActivity(fileId: string, fileName: string) {
    const file = files.find((f) => f.id === fileId);
    if (file) {
      setPreviewFile(file);
      return;
    }
    toast.info(`"${fileName}" is not available in the current view`);
  }

  return {
    previewFile,
    setPreviewFile,
    quickLookFile,
    openQuickLook,
    closeQuickLook,
    handleQuickLookNavigate,
    sidebarCollapsed,
    setSidebarCollapsed,
    uploading,
    uploadLabel,
    uploadInputRef,
    paletteOpen,
    setPaletteOpen,
    globalSearchOpen,
    setGlobalSearchOpen,
    shortcutsOpen,
    setShortcutsOpen,
    paletteActions,
    showNewFolder,
    setShowNewFolder,
    renameTarget,
    setRenameTarget,
    shareTarget,
    setShareTarget,
    moveTargets,
    setMoveTargets,
    deleteForeverTargets,
    setDeleteForeverTargets,
    emptyTrashConfirm,
    setEmptyTrashConfirm,
    bulkRenameOpen,
    setBulkRenameOpen,
    menu,
    setMenu,
    tagManageOpen,
    setTagManageOpen,
    tagPickerOpen,
    setTagPickerOpen,
    tagPickerFileIds,
    tagPickerFileNames,
    tagPickerLabel,
    saveViewOpen,
    setSaveViewOpen,
    coverModalFolder,
    setCoverModalFolder,
    handleSetFolderCover,
    handleRemoveFolderCover,
    handleUploadFolderCover,
    openFile,
    navigateTo,
    goBack,
    openMenu,
    openTagPicker,
    captureCurrentViewScope,
    setTagFilterMode,
    handleOpenFileFromActivity,
    runPaletteAction,
    handleCreateFolder,
    handleUpload,
    handleToggleStar,
    handleTogglePin,
    handleToggleFavorite,
    handleToggleHidden,
    handleCut,
    handleCopy,
    handlePaste,
    handleCancelClipboard,
    onFileChanged,
    onFileDeleted,
    handleDownload,
    handleRename,
    handleTrashFiles,
    handleRestoreFiles,
    handleDeleteForever,
    handleEmptyTrash,
    handleMoveMany,
    handleBulkDownload,
    handleItemSelect,
    dragDrop,
    isBlockingModalOpen,
    canUndo,
    executeUndo,
  };
}
