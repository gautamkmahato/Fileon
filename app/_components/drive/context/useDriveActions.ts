"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { useDragDrop } from "@/lib/hooks/useDragDrop";
import { canUndo, executeUndo } from "@/lib/activity/undo";
import { getSelectedIdSet, useBrowseStore, useFilesStore } from "@/lib/stores";
import { usePins } from "../../pins/PinsProvider";
import { useFavorites } from "../../favorites/FavoritesProvider";
import { useHidden } from "../../hidden/HiddenProvider";
import { useFolderCovers } from "../../folder-covers/FolderCoversProvider";
import { buildDefaultActions, type PaletteActionId } from "../../ui/CommandPalette";
import type { DriveRouteState } from "./drive-browse-types";
import type { DriveFilesContext } from "./drive-files-types";
import { useDriveDialogs } from "./useDriveDialogs";
import { createCoreActions } from "./actions/core";
import { createNavigationActions } from "./actions/navigation";
import { createFileActions } from "./actions/files";
import { createTrashActions } from "./actions/trash";
import { createMoveActions } from "./actions/move";
import { createClipboardActions } from "./actions/clipboard";
import { createOrganizeActions } from "./actions/organize";
import { createFolderCoverActions } from "./actions/folder-covers";
import type { DriveActionContext } from "./actions/types";

export interface UseDriveActionsParams {
  token: string | null;
  signOut: () => void;
  routeState: DriveRouteState;
  filesCtx: DriveFilesContext;
  clearSelection: () => void;
}

/**
 * Composes every user-triggered drive action plus the dialog state that
 * drives the shell. Action groups live in `./actions/*` and receive a shared
 * {@link DriveActionContext} so they can be read (and tested) in isolation.
 */
export function useDriveActions({
  token,
  signOut,
  routeState,
  filesCtx,
  clearSelection,
}: UseDriveActionsParams) {
  const router = useRouter();
  const pins = usePins();
  const favorites = useFavorites();
  const hidden = useHidden();
  const folderCovers = useFolderCovers();

  const uploadInputRef = useRef<HTMLInputElement>(null);
  const uploading = useFilesStore((s) => s.uploading);
  const uploadLabel = useFilesStore((s) => s.uploadLabel);
  const view = useBrowseStore((s) => s.view);
  const paletteActions = buildDefaultActions(view);

  const dialogs = useDriveDialogs();

  const base = {
    token,
    router,
    route: routeState,
    filesCtx,
    clearSelection,
    previewFile: dialogs.previewFile,
    setPreviewFile: dialogs.setPreviewFile,
  };
  const ctx: DriveActionContext = { ...base, ...createCoreActions(base) };

  const trash = createTrashActions(ctx);
  const navigation = createNavigationActions(ctx, { handleRestoreFiles: trash.handleRestoreFiles });
  const fileActions = createFileActions(ctx, { uploading });
  const move = createMoveActions(ctx);
  const clipboard = createClipboardActions(ctx, { handleMoveMany: move.handleMoveMany });
  const organize = createOrganizeActions(ctx, { pins, favorites, hidden });
  const covers = createFolderCoverActions(ctx, folderCovers);

  const dragDrop = useDragDrop({
    onUploadFiles: (fl) => fileActions.handleUpload(fl),
    onMoveFiles: (ids, folderId) => {
      const moveFiles = filesCtx.files.filter((f) => ids.includes(f.id));
      const destName = filesCtx.files.find((f) => f.id === folderId)?.name;
      move.handleMoveMany(moveFiles, folderId, destName);
    },
    getDragFileIds: () => [...getSelectedIdSet()],
  });

  function runPaletteAction(id: PaletteActionId) {
    switch (id) {
      case "new-folder": dialogs.setShowNewFolder(true); break;
      case "upload": uploadInputRef.current?.click(); break;
      case "toggle-view": useBrowseStore.getState().setView(view === "grid" ? "list" : "grid"); break;
      case "sign-out": signOut(); break;
    }
  }

  return {
    ...dialogs,
    uploading,
    uploadLabel,
    uploadInputRef,
    paletteActions,
    runPaletteAction,
    ...navigation,
    ...fileActions,
    ...trash,
    ...move,
    ...clipboard,
    ...organize,
    ...covers,
    onFileChanged: ctx.onFileChanged,
    onFileDeleted: ctx.onFileDeleted,
    dragDrop,
    canUndo,
    executeUndo,
  };
}
