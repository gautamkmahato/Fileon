import { type DriveFile, downloadFile, exportFile, isGoogleNative } from "@/lib/drive/drive";
import { prepareActivityUndo } from "@/lib/activity/log";
import { pushUndo } from "@/lib/activity/undo";
import { recordRecentFolderWork } from "@/lib/collections/recent-folders";
import { isFolderBrowseView } from "@/lib/drive/browse-scope";
import { useCleanupStore } from "@/lib/cleanup/store";
import { patchCleanupFile, removeCleanupFile } from "@/lib/cleanup/repository";
import { patchDriveFileInCache } from "@/lib/cache/drive-memory";
import { invalidateCachesForFileMutation } from "@/lib/cache/session-cache";
import { useFilesStore, useSelectionStore } from "@/lib/stores";
import type { DriveActionContext } from "./types";

export function parentIdForFolderTree(parentId: string | null | undefined): string | null {
  if (!parentId || parentId === "root") return null;
  return parentId;
}

export function parentsFromFiles(files: DriveFile[]): (string | null)[] {
  return files.map((f) => parentIdForFolderTree(f.parents?.[0]));
}

/** Download a file (exporting Google-native docs as PDF) and hand it to the browser. */
export async function downloadToBrowser(token: string, file: DriveFile): Promise<void> {
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
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

type CoreBase = Omit<DriveActionContext, "markFolderWork" | "recordUndoAction" | "onFileChanged" | "onFileDeleted">;

/** Shared side-effect helpers used by every action group. */
export function createCoreActions(base: CoreBase) {
  const { route, filesCtx, previewFile, setPreviewFile } = base;
  const { sidebarView, routeFolderId } = route;
  const { currentFolder, folderContext } = filesCtx;

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

  const recordUndoAction: DriveActionContext["recordUndoAction"] = async (opts) => {
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
  };

  function onFileChanged(updated: DriveFile) {
    useFilesStore.getState().updateFile(updated);
    useCleanupStore.getState().updateFile(updated);
    const userId = useCleanupStore.getState().hydratedUserId;
    if (userId) void patchCleanupFile(userId, updated).catch(() => {});
    if (previewFile?.id === updated.id) setPreviewFile(updated);
    patchDriveFileInCache(updated);
  }

  function onFileDeleted(id: string) {
    useFilesStore.getState().removeFile(id);
    useSelectionStore.getState().removeFromSelection(id);
    useCleanupStore.getState().removeFile(id);
    const userId = useCleanupStore.getState().hydratedUserId;
    if (userId) void removeCleanupFile(userId, id).catch(() => {});
    invalidateCachesForFileMutation(id);
  }

  return { markFolderWork, recordUndoAction, onFileChanged, onFileDeleted };
}
